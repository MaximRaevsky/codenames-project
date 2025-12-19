import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
}

export function Logo({ size = 'md', animate = true }: LogoProps) {
  const sizes = {
    sm: { container: 'w-12 h-12', text: 'text-lg', icon: 24 },
    md: { container: 'w-20 h-20', text: 'text-2xl', icon: 36 },
    lg: { container: 'w-32 h-32', text: 'text-4xl', icon: 56 },
    xl: { container: 'w-48 h-48', text: 'text-6xl', icon: 80 },
  };

  const s = sizes[size];

  const containerVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { 
      scale: 1, 
      opacity: 1,
      transition: { duration: 0.5, ease: 'easeOut' }
    },
  };

  const letterVariants = {
    initial: { y: 20, opacity: 0 },
    animate: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.1 + 0.3, duration: 0.4 }
    }),
  };

  return (
    <motion.div
      className="flex flex-col items-center"
      variants={animate ? containerVariants : undefined}
      initial={animate ? 'initial' : undefined}
      animate={animate ? 'animate' : undefined}
    >
      {/* Logo Icon */}
      <motion.div
        className={`${s.container} relative flex items-center justify-center mb-4`}
      >
        {/* Background circles */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 transform rotate-6 opacity-80" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 transform -rotate-6 opacity-80" />
        
        {/* Main logo card */}
        <motion.div 
          className="relative z-10 w-full h-full rounded-2xl bg-white shadow-xl flex items-center justify-center"
          whileHover={animate ? { scale: 1.05 } : undefined}
        >
          {/* Grid pattern */}
          <div className="absolute inset-2 grid grid-cols-3 grid-rows-3 gap-1 opacity-20">
            {[...Array(9)].map((_, i) => (
              <div 
                key={i} 
                className={`rounded ${
                  i === 0 || i === 4 ? 'bg-red-500' : 
                  i === 2 || i === 8 ? 'bg-blue-500' : 
                  'bg-gray-400'
                }`}
              />
            ))}
          </div>
          
          {/* Center icon - magnifying glass / detective theme */}
          <svg 
            width={s.icon} 
            height={s.icon} 
            viewBox="0 0 48 48" 
            fill="none"
            className="relative z-10"
          >
            {/* Magnifying glass */}
            <circle cx="20" cy="20" r="12" stroke="#3b82f6" strokeWidth="3" fill="none" />
            <line x1="28" y1="28" x2="40" y2="40" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />
            {/* Question mark */}
            <text x="15" y="25" fontSize="16" fontWeight="bold" fill="#1f2937">?</text>
          </svg>
        </motion.div>
      </motion.div>

      {/* Text logo */}
      <div className={`font-display font-bold ${s.text} flex items-center gap-1`}>
        {['C', 'o'].map((letter, i) => (
          <motion.span
            key={i}
            className="text-red-500"
            variants={animate ? letterVariants : undefined}
            initial={animate ? 'initial' : undefined}
            animate={animate ? 'animate' : undefined}
            custom={i}
          >
            {letter}
          </motion.span>
        ))}
        {['N', 'a', 'm', 'e'].map((letter, i) => (
          <motion.span
            key={i + 2}
            className="text-blue-500"
            variants={animate ? letterVariants : undefined}
            initial={animate ? 'initial' : undefined}
            animate={animate ? 'animate' : undefined}
            custom={i + 2}
          >
            {letter}
          </motion.span>
        ))}
      </div>
      
      <motion.p 
        className="text-gray-500 text-sm mt-2 font-medium"
        initial={animate ? { opacity: 0 } : undefined}
        animate={animate ? { opacity: 1, transition: { delay: 0.8 } } : undefined}
      >
        Human-AI Teammate for Codenames
      </motion.p>
    </motion.div>
  );
}

