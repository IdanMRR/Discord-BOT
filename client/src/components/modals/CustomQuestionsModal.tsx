import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { apiService } from '../../services/api';
import {
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfigModal from '../common/ConfigModal';
import ActionButton from '../common/ActionButton';

// Utility function for conditional class names
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface CustomQuestion {
  id: string;
  question: string;
  answer: string;
  case_sensitive: boolean;
}

interface CustomQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
}

const CustomQuestionsModal: React.FC<CustomQuestionsModalProps> = ({
  isOpen,
  onClose,
  serverId
}) => {
  const { darkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    answer: '',
    case_sensitive: false
  });


  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getCustomQuestions(serverId);
      
      if (response.success && response.data) {
        setQuestions(response.data);
      } else {
        console.warn('Failed to load custom questions:', response);
      }
    } catch (error) {
      console.error('Error loading custom questions:', error);
      toast.error('Failed to load custom questions');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (isOpen && serverId) {
      loadQuestions();
    }
  }, [isOpen, serverId, loadQuestions]);

  const handleAddQuestion = async () => {
    if (!newQuestion.question.trim() || !newQuestion.answer.trim()) {
      toast.error('Please provide both question and answer');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.addCustomQuestion(serverId, newQuestion);
      
      if (response.success) {
        toast.success('Question added successfully!');
        setNewQuestion({ question: '', answer: '', case_sensitive: false });
        await loadQuestions();
      } else {
        toast.error('Failed to add question');
      }
    } catch (error) {
      console.error('Error adding question:', error);
      toast.error('Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!window.confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.deleteCustomQuestion(serverId, questionId);
      
      if (response.success) {
        toast.success('Question deleted successfully!');
        await loadQuestions();
      } else {
        toast.error('Failed to delete question');
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Failed to delete question');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ConfigModal
      isOpen={isOpen}
      onClose={onClose}
      title="Custom Questions Management"
      description="Create and manage custom verification questions"
      icon="❓"
      maxWidth="2xl"
      loading={loading}
      loadingText="Loading questions..."
      actions={
        <div className="flex items-center justify-between w-full">
          <div className="flex space-x-3">
            <span className={classNames(
              "text-sm",
              darkMode ? "text-gray-400" : "text-gray-600"
            )}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} configured
            </span>
          </div>
          <div className="flex space-x-3">
            <ActionButton
              onClick={onClose}
              variant="outline"
              disabled={saving}
            >
              Close
            </ActionButton>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Add New Question */}
        <div className={classNames(
          "p-4 rounded-lg border",
          darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
        )}>
          <h3 className={classNames(
            "text-lg font-medium mb-4",
            darkMode ? "text-gray-200" : "text-gray-800"
          )}>
            Add New Question
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Question
              </label>
              <input
                type="text"
                value={newQuestion.question}
                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                placeholder="What is the server's main topic?"
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                )}
              />
            </div>
            
            <div>
              <label className={classNames(
                "block text-sm font-medium mb-1",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Expected Answer
              </label>
              <input
                type="text"
                value={newQuestion.answer}
                onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                placeholder="Gaming"
                className={classNames(
                  "w-full px-3 py-2 rounded-lg border transition-colors",
                  darkMode 
                    ? "bg-gray-700 border-gray-600 text-gray-200 focus:border-blue-500" 
                    : "bg-white border-gray-300 text-gray-900 focus:border-blue-500",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                )}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="case-sensitive"
                checked={newQuestion.case_sensitive}
                onChange={(e) => setNewQuestion({ ...newQuestion, case_sensitive: e.target.checked })}
                className="rounded border-gray-300 focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="case-sensitive" className={classNames(
                "text-sm",
                darkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Case sensitive answer
              </label>
            </div>
            
            <div className="flex justify-end">
              <ActionButton
                onClick={handleAddQuestion}
                disabled={saving || !newQuestion.question.trim() || !newQuestion.answer.trim()}
                loading={saving}
                variant="success"
                icon={PlusIcon}
              >
                Add Question
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Existing Questions */}
        <div>
          <h3 className={classNames(
            "text-lg font-medium mb-4",
            darkMode ? "text-gray-200" : "text-gray-800"
          )}>
            Current Questions
          </h3>
          
          {questions.length === 0 ? (
            <div className={classNames(
              "text-center py-8 rounded-lg border-2 border-dashed",
              darkMode ? "border-gray-600 text-gray-400" : "border-gray-300 text-gray-500"
            )}>
              <div className="text-4xl mb-2">❓</div>
              <p>No custom questions configured yet.</p>
              <p className="text-sm mt-1">Add your first question above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={question.id} className={classNames(
                  "p-4 rounded-lg border",
                  darkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={classNames(
                          "text-sm font-medium",
                          darkMode ? "text-gray-300" : "text-gray-600"
                        )}>
                          Question #{index + 1}
                        </span>
                        {question.case_sensitive && (
                          <span className={classNames(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
                          )}>
                            Case Sensitive
                          </span>
                        )}
                      </div>
                      
                      <div className="mb-2">
                        <p className={classNames(
                          "font-medium",
                          darkMode ? "text-gray-200" : "text-gray-800"
                        )}>
                          Q: {question.question}
                        </p>
                      </div>
                      
                      <div>
                        <p className={classNames(
                          "text-sm",
                          darkMode ? "text-gray-400" : "text-gray-600"
                        )}>
                          Expected Answer: <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">{question.answer}</span>
                        </p>
                      </div>
                    </div>
                    
                    <ActionButton
                      onClick={() => handleDeleteQuestion(question.id)}
                      disabled={saving}
                      variant="danger"
                      size="sm"
                      icon={TrashIcon}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ConfigModal>
  );
};

export default CustomQuestionsModal;