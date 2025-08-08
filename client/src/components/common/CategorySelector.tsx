import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

// Utility function for conditional class names
function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface Category {
  id: string;
  name: string;
  type: number;
}

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  serverId: string;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({ 
  value, 
  onChange, 
  disabled = false,
  serverId 
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      if (!serverId) return;
      
      try {
        const response = await apiService.getServerChannels(serverId);
        if (response.success && response.data) {
          // Filter for category channels only (type 4)
          const categoryChannels = response.data.filter((category: Category) => category.type === 4);
          setCategories(categoryChannels);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [serverId]);

  if (loading) {
    return (
      <select 
        disabled 
        className="w-full px-3 py-2 rounded-lg border transition-colors bg-background border-border text-foreground opacity-50"
      >
        <option>Loading categories...</option>
      </select>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={classNames(
        "w-full px-3 py-2 rounded-lg border transition-colors bg-background border-border text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
        disabled ? "opacity-50 cursor-not-allowed" : ""
      )}
    >
      <option value="">-- Select Category --</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
};

export default CategorySelector;