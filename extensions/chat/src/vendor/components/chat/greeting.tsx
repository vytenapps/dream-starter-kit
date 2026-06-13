import { motion } from "motion/react";

export const Greeting = () => {
  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-foreground text-center text-2xl font-semibold tracking-tight md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        What can I help with?
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-muted-foreground/80 mt-3 text-center text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        Ask a question, write code, or explore ideas.
      </motion.div>
    </div>
  );
};
