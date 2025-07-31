import React from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({ 
  title, 
  description, 
  children, 
  className = '', 
  padding = true 
}) => {
  return (
    <div className={`card ${!padding ? 'p-0' : ''} ${className}`}>
      {(title || description) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {description && <p className="card-description">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
