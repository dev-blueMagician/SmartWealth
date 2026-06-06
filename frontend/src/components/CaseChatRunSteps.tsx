/**
 * Single-line run status: one phrase at a time with shimmer (replaces list layout).
 */

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  type ChatRunStepRow,
  currentRunStepFromSteps,
  resolveRunStatusLabel,
} from '../domain/caseChatRunEvents';

function ShimmerLabel({ text }: { text: string }) {
  /* Dark base (zinc-900) most of the width; narrow light band moves for readability. */
  const band =
    'linear-gradient(90deg, rgb(24 24 27) 0%, rgb(24 24 27) 40%, rgb(250 250 250) 50%, rgb(24 24 27) 60%, rgb(24 24 27) 100%)';

  return (
    <motion.span
      className="inline-block min-w-0 max-w-full truncate bg-clip-text font-medium text-transparent antialiased"
      style={{
        backgroundImage: band,
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
      }}
      animate={{ backgroundPosition: ['100% 50%', '-100% 50%'] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
    >
      {text}
    </motion.span>
  );
}

export type CaseChatRunStepsCompactProps = {
  /** When no structured steps yet, show a single shimmer line. */
  fallbackLabel?: string;
  steps: ChatRunStepRow[];
  className?: string;
};

export function CaseChatRunStepsCompact({
  steps,
  fallbackLabel = 'Đang xử lý…',
  className,
}: CaseChatRunStepsCompactProps) {
  const step = currentRunStepFromSteps(steps);
  const label = step ? resolveRunStatusLabel(step) : fallbackLabel;
  const motionKey = step
    ? `${step.code}:${step.httpMethod ?? ''}:${step.labelVi ?? ''}:${step.target ?? ''}:${step.detail ?? ''}`
    : '__fallback__';

  return (
    <div className={cn('mt-2 min-h-[1.35rem] text-[13px] leading-snug', className)}>
      <AnimatePresence mode="wait">
        <motion.p
          key={motionKey}
          className="truncate text-left font-medium text-[13px] antialiased"
          title={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <ShimmerLabel text={label} />
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
