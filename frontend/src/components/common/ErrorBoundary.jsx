import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow border border-red-200 p-6">
            <h1 className="text-lg font-semibold text-red-600 mb-2">⚠️ Fehler beim Rendern</h1>
            <p className="text-sm font-mono bg-red-50 rounded p-3 text-red-800 mb-4 whitespace-pre-wrap break-all">
              {this.state.error?.toString()}
            </p>
            {this.state.info?.componentStack && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700 mb-1">Komponenten-Stack</summary>
                <pre className="bg-gray-50 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {this.state.info.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => this.setState({ error: null, info: null })}
              className="mt-4 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
            >
              Neu laden versuchen
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
