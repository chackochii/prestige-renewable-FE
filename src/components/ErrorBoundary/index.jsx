// Catches render errors inside the content area so the shell stays usable.

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card card-pad">
        <h2>This page failed to load</h2>
        <p className="lede" style={{ marginBottom: 16 }}>
          {this.state.error.message || String(this.state.error)}
        </p>
        <button className="btn btn-primary" type="button" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
