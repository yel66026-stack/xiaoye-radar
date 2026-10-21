import React from "react";
import { createRoot } from "react-dom/client";
import App from "./DesktopApp.jsx";
import "./styles.css";
import "./desktop.css";
import "./clarity.css";

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>页面暂时遇到了一点问题</h1>
        <p>已保存的数据仍在本机 SQLite 数据库中，请重新载入继续。</p>
        <button className="btn primary" onClick={() => location.reload()}>
          重新载入
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
