/**
 * RouteErrorBoundary - Lightweight error boundary for individual routes.
 *
 * Unlike the global ErrorBoundary (which catches everything and redirects to home),
 * this component:
 * - Catches errors within a single route/page
 * - Offers a "retry" button that resets the error without navigating away
 * - Shows error details in development mode
 * - Can be wrapped around any page component
 *
 * Usage:
 *   <Route path="/foo" element={
 *     <RouteErrorBoundary pageName="Foo Page">
 *       <FooPage />
 *     </RouteErrorBoundary>
 *   } />
 */
import React, { Component, type ReactNode } from 'react';
import { Button, Typography, Empty, Space } from '@douyinfe/semi-ui';
import { IconRefresh, IconHome } from '@douyinfe/semi-icons';
import type { CSSProperties } from 'react';

const { Text, Title } = Typography;

const S: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
    padding: 48,
    gap: 16,
  },
  errorDetail: {
    maxWidth: 600,
    padding: 16,
    background: 'var(--semi-color-fill-0)',
    borderRadius: 8,
    fontFamily: 'monospace',
    fontSize: 12,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    color: 'var(--semi-color-danger)',
    maxHeight: 200,
    overflow: 'auto',
  },
  buttons: {
    marginTop: 16,
  },
};

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[RouteErrorBoundary] ${this.props.pageName || 'Unknown page'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const pageName = this.props.pageName || '页面';

      return (
        <div style={S.container}>
          <Empty
            title={`${pageName}加载出错`}
            description="抱歉，该页面遇到了问题。您可以尝试重试或返回首页。"
          />

          {isDev && this.state.error && (
            <div style={S.errorDetail}>
              <Text strong>{this.state.error.name}: {this.state.error.message}</Text>
              {this.state.errorInfo?.componentStack && (
                <Text>{this.state.errorInfo.componentStack}</Text>
              )}
            </div>
          )}

          <Space style={S.buttons}>
            <Button
              icon={<IconRefresh />}
              theme="solid"
              type="primary"
              onClick={this.handleRetry}
            >
              重试
            </Button>
            <Button
              icon={<IconHome />}
              theme="light"
              onClick={this.handleGoHome}
            >
              返回首页
            </Button>
          </Space>
        </div>
      );
    }

    return this.props.children;
  }
}
