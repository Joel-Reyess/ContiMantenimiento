import { cn } from '@/lib/utils';

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'yellow' | 'blue' | 'green';
}

const variantStyles = {
  default: 'hover:border-continental-yellow hover:shadow-continental-yellow/20',
  yellow: 'hover:border-continental-yellow hover:shadow-continental-yellow/20',
  blue: 'hover:border-continental-blue hover:shadow-continental-blue/20',
  green: 'hover:border-continental-green hover:shadow-continental-green/20',
};

export function ActionCard({ icon, title, description, onClick, variant = 'default' }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'dashboard-card w-full cursor-pointer text-center transition-all duration-300',
        'border-2 border-transparent px-8 py-9 hover:-translate-y-1 flex flex-col items-center',
        variantStyles[variant]
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-continental-gray-4/70 mx-auto">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-continental-black mb-2">{title}</h3>
      <p className="text-sm text-continental-gray-1">{description}</p>
    </button>
  );
}
