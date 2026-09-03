import { Component, ReactNode, createRef } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  private headingRef = createRef<HTMLHeadingElement>();

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  componentDidMount() {
    if (this.state.hasError) {
      this.headingRef.current?.focus();
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-shell" role="alert" aria-live="assertive">
          <div className="error-card">
            <div className="error-icon">
              <AlertTriangle size={40} strokeWidth={2.5} />
            </div>
            <p className="error-kicker">
              <span className="status-dot status-dot-red" />
              SYSTEM ERROR / 500
            </p>
            <h1
              ref={this.headingRef}
              tabIndex={-1}
              style={{ outline: "none" }}
              className="error-title"
            >
              The world<br />
              <i>glitched.</i>
            </h1>
            <p className="error-copy">
              Something unexpected happened while exploring. Don’t worry —
              your sidequest is safe. Reload to reset the simulation.
            </p>
            <button className="sq-button sq-button-red" onClick={() => window.location.reload()}>
              <RotateCcw size={16} />
              Reload world
            </button>
            <details className="error-details">
              <summary>Technical details</summary>
              <pre>{this.state.error?.stack ?? "No stack trace available."}</pre>
            </details>
          </div>

          <style>{`
            .error-shell {
              min-height: 100svh;
              display: grid;
              place-items: center;
              padding: 24px;
              background: var(--night);
              color: var(--paper);
              font-family: "Space Grotesk", Arial, sans-serif;
              overflow: hidden;
              position: relative;
            }

            .error-shell::before {
              content: "";
              position: absolute;
              width: 600px;
              height: 600px;
              border: 2px dashed rgba(var(--paper-light-rgb), 0.15);
              border-radius: 50%;
              transform: rotate(25deg);
              pointer-events: none;
            }

            .error-card {
              position: relative;
              z-index: 1;
              max-width: 520px;
              width: 100%;
              padding: 44px 32px;
              text-align: center;
              border: 1px solid var(--paper);
              background: rgba(var(--ink-rgb), 0.8);
              box-shadow: 10px 10px 0 var(--coral);
              backdrop-filter: blur(10px);
              transform: rotate(-1.5deg);
            }

            .error-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 80px;
              height: 80px;
              margin-bottom: 24px;
              background: var(--yellow);
              color: var(--ink);
              border: 1px solid var(--ink);
              box-shadow: 5px 5px 0 var(--coral);
              transform: rotate(-6deg);
            }

            .error-kicker {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              margin: 0 0 12px;
              color: var(--red);
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.115em;
              text-transform: uppercase;
            }

            .error-title {
              margin: 0 0 18px;
              font-family: "DM Serif Display", Georgia, serif;
              font-size: clamp(48px, 9vw, 76px);
              font-weight: 400;
              line-height: 0.9;
              letter-spacing: -0.06em;
              color: var(--paper);
            }

            .error-title i {
              color: var(--coral);
              font-style: italic;
            }

            .error-copy {
              max-width: 340px;
              margin: 0 auto 32px;
              color: rgba(var(--paper-light-rgb), 0.7);
              font-size: 13px;
              line-height: 1.7;
            }

            .sq-button-red {
              background: var(--coral);
              color: var(--ink);
              box-shadow: 5px 5px 0 var(--yellow);
            }

            .sq-button-red:hover {
              background: var(--blue);
              color: var(--paper);
              box-shadow: 2px 2px 0 var(--yellow);
              transform: translate(2px, 2px);
            }

            .sq-button-red:active {
              transform: translate(5px, 5px);
              box-shadow: 0 0 0 var(--yellow);
            }

            .error-details {
              margin-top: 30px;
              text-align: left;
              border: 1px solid rgba(var(--paper-light-rgb), 0.2);
              background: rgba(var(--night-rgb), 0.5);
              padding: 10px 14px;
            }

            .error-details summary {
              cursor: pointer;
              font-size: 10px;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              color: var(--yellow);
              font-weight: 700;
            }

            .error-details pre {
              margin: 10px 0 0;
              font-size: 11px;
              color: rgba(var(--paper-light-rgb), 0.8);
              white-space: pre-wrap;
              word-break: break-word;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;