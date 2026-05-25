import { Component, ReactNode } from 'react';
import Button from './common/components/Button/Button';
import Modal from './common/components/Modal/Modal';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    return (
      <>
        {this.props.children}
        <Modal
          isOpen={this.state.hasError}
          onClose={() => window.location.reload()}
          title="Something went wrong"
          footer={
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          }
        >
          <p>An unexpected error occurred. Please reload the page.</p>
        </Modal>
      </>
    );
  }
}
