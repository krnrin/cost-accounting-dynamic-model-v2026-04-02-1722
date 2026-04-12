import React, { Component, type ReactNode } from 'react';
import { Button, Typography, Empty } from '@douyinfe/semi-ui';

const { Text } = Typography;

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 40,
          textAlign: 'center',
        }}>
          <Empty
            title="页面出错了"
            description="抱歉，该页面遇到了问题"
          />
          <Text
            type="tertiary"
            style={{
              marginTop: 16,
              maxWidth: 600,
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              fontSize: 12,
            }}
          >
            {this.state.error?.message}
          </Text>
          <Button
            theme="solid"
            type="primary"
            style={{ marginTop: 24 }}
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
          >
            返回首页
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
