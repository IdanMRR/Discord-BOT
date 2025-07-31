import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Checkbox } from './Checkbox';
import { RadioButton } from './RadioButton';
import { ThemeToggle } from './ThemeToggle';
import Card from './Card';

export const StyleGuideDemo: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: '',
    notifications: false,
    preference: 'option1'
  });

  const selectOptions = [
    { value: '', label: 'Select a category...' },
    { value: 'general', label: 'General' },
    { value: 'support', label: 'Support' },
    { value: 'billing', label: 'Billing' }
  ];

  return (
    <div className="page-container p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
          React Styling Guide Demo
        </h1>
        <ThemeToggle />
      </div>

      {/* Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title="Basic Card" description="This is a basic card component">
          <p style={{ color: 'var(--card-foreground)' }}>
            Cards use the CSS variables for consistent theming across light and dark modes.
          </p>
        </Card>

        <Card title="Form Example">
          <div className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            
            <Input
              label="Email Address"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            
            <Select
              label="Category"
              options={selectOptions}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            />
          </div>
        </Card>

        <Card title="Interactive Elements">
          <div className="space-y-4">
            <Checkbox
              label="Enable Notifications"
              checked={formData.notifications}
              onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
            />
            
            <div className="space-y-2">
              <RadioButton
                label="Option 1"
                name="preference"
                value="option1"
                checked={formData.preference === 'option1'}
                onChange={(e) => setFormData({ ...formData, preference: e.target.value })}
              />
              <RadioButton
                label="Option 2"
                name="preference"
                value="option2"
                checked={formData.preference === 'option2'}
                onChange={(e) => setFormData({ ...formData, preference: e.target.value })}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Buttons Section */}
      <Card title="Button Variants">
        <div className="flex flex-wrap gap-4">
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="destructive">Destructive Button</Button>
          <Button variant="primary" disabled>Disabled Button</Button>
        </div>
      </Card>

      {/* Table Section */}
      <Card title="Table Example">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>John Doe</td>
                <td>john@example.com</td>
                <td>Admin</td>
                <td>
                  <span className="toast success inline-block px-2 py-1 text-xs rounded">
                    Active
                  </span>
                </td>
              </tr>
              <tr>
                <td>Jane Smith</td>
                <td>jane@example.com</td>
                <td>User</td>
                <td>
                  <span className="toast warning inline-block px-2 py-1 text-xs rounded">
                    Pending
                  </span>
                </td>
              </tr>
              <tr>
                <td>Bob Johnson</td>
                <td>bob@example.com</td>
                <td>Moderator</td>
                <td>
                  <span className="toast error inline-block px-2 py-1 text-xs rounded">
                    Inactive
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Color Palette Section */}
      <Card title="Color Palette">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div 
              className="w-full h-16 rounded border"
              style={{ backgroundColor: 'var(--primary)' }}
            ></div>
            <p className="text-sm font-medium">Primary</p>
          </div>
          <div className="space-y-2">
            <div 
              className="w-full h-16 rounded border"
              style={{ backgroundColor: 'var(--secondary)' }}
            ></div>
            <p className="text-sm font-medium">Secondary</p>
          </div>
          <div className="space-y-2">
            <div 
              className="w-full h-16 rounded border"
              style={{ backgroundColor: 'var(--accent)' }}
            ></div>
            <p className="text-sm font-medium">Accent</p>
          </div>
          <div className="space-y-2">
            <div 
              className="w-full h-16 rounded border"
              style={{ backgroundColor: 'var(--destructive)' }}
            ></div>
            <p className="text-sm font-medium">Destructive</p>
          </div>
        </div>
      </Card>
    </div>
  );
};