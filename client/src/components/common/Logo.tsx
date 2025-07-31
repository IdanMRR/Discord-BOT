import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true }) => {
  // Size classes
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-16'
  };
  
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };
  
  return (
    <div className="flex items-center">
      <svg 
        className={`${sizeClasses[size]} ${showText ? 'mr-3' : ''}`}
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Atomic structure outer rings */}
        <ellipse 
          cx="50" 
          cy="50" 
          rx="40" 
          ry="20" 
          stroke="#3B82F6" 
          strokeWidth="2.5" 
          fill="none"
          transform="rotate(45 50 50)"
        />
        <ellipse 
          cx="50" 
          cy="50" 
          rx="40" 
          ry="20" 
          stroke="#3B82F6" 
          strokeWidth="2.5" 
          fill="none"
          transform="rotate(-45 50 50)"
        />
        <ellipse 
          cx="50" 
          cy="50" 
          rx="40" 
          ry="20" 
          stroke="#3B82F6" 
          strokeWidth="2.5" 
          fill="none"
          transform="rotate(0 50 50)"
        />
        
        {/* Central atom/nucleus */}
        <circle 
          cx="50" 
          cy="50" 
          r="3" 
          fill="#3B82F6"
        />
        
        {/* Robot head/body */}
        <rect 
          x="35" 
          y="35" 
          width="30" 
          height="30" 
          rx="8" 
          ry="8" 
          stroke="#3B82F6" 
          strokeWidth="3" 
          fill="none"
        />
        
        {/* Robot eyes */}
        <circle 
          cx="43" 
          cy="45" 
          r="2.5" 
          fill="#3B82F6"
        />
        <circle 
          cx="57" 
          cy="45" 
          r="2.5" 
          fill="#3B82F6"
        />
        
        {/* Robot smile */}
        <path 
          d="M 42 55 Q 50 60 58 55" 
          stroke="#3B82F6" 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
        />
        
        {/* Robot antenna */}
        <line 
          x1="50" 
          y1="35" 
          x2="50" 
          y2="28" 
          stroke="#3B82F6" 
          strokeWidth="2"
        />
        <circle 
          cx="50" 
          cy="26" 
          r="2" 
          fill="#3B82F6"
        />
      </svg>
      
      {showText && (
        <span className={`font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent ${textSizeClasses[size]}`}>
          PanelOps
        </span>
      )}
    </div>
  );
};

export default Logo; 