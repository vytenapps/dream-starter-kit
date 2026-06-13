import { memo } from "react";

import { initialArtifactData, useArtifact } from "../../hooks/use-artifact";
import { CrossIcon } from "./icons";

function PureArtifactCloseButton() {
  const { setArtifact } = useArtifact();

  return (
    <button
      className="group text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground flex size-8 items-center justify-center rounded-lg border border-transparent transition-all duration-150 active:scale-95"
      data-testid="artifact-close-button"
      onClick={() => {
        setArtifact((currentArtifact) =>
          currentArtifact.status === "streaming"
            ? {
                ...currentArtifact,
                isVisible: false,
              }
            : { ...initialArtifactData, status: "idle" },
        );
      }}
      type="button"
    >
      <CrossIcon size={16} />
    </button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
