import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { useTheme } from '../providers/ThemeProvider';
import { cn } from '../../lib/utils';

interface ColorCustomizerProps {
  className?: string;
}

export function ColorCustomizer({ className }: ColorCustomizerProps) {
  const { primaryColor, setPrimaryColor, applyColorPreset, colorPresets } = useTheme();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState(primaryColor);

  const handleColorChange = (color: string) => {
    setTempColor(color);
  };

  const handleApplyColor = () => {
    setPrimaryColor(tempColor);
    setIsPickerOpen(false);
  };

  const handlePresetClick = (presetName: keyof typeof colorPresets) => {
    applyColorPreset(presetName);
    setIsPickerOpen(false);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3">Theme Colors</h3>
        
        {/* Color Presets */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Object.entries(colorPresets).map(([name, color]) => (
            <button
              key={name}
              onClick={() => handlePresetClick(name as keyof typeof colorPresets)}
              className={cn(
                'w-8 h-8 rounded-full border-2 border-border hover:border-ring transition-colors',
                primaryColor === color && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
              )}
              style={{ backgroundColor: color }}
              title={name.charAt(0).toUpperCase() + name.slice(1)}
            />
          ))}
        </div>

        {/* Custom Color Picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Custom Color</span>
            <button
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className={cn(
                'w-8 h-8 rounded-full border-2 border-border hover:border-ring transition-colors',
                isPickerOpen && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
              )}
              style={{ backgroundColor: primaryColor }}
            />
          </div>

          {isPickerOpen && (
            <div className="p-4 bg-card border border-border rounded-lg shadow-lg">
              <HexColorPicker color={tempColor} onChange={handleColorChange} />
              
              <div className="mt-4 flex items-center justify-between">
                <input
                  type="text"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  className="px-3 py-1 text-sm bg-background border border-input rounded font-mono"
                  placeholder="#ffffff"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPickerOpen(false)}
                    className="px-3 py-1 text-sm bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyColor}
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground hover:opacity-90 rounded transition-opacity"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}