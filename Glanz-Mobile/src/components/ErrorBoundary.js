import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Catches unhandled JS errors in the component tree and shows a recovery screen
 * instead of a blank/crashed app.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    // Log for debugging without exposing full stack to end users
    console.error('[ErrorBoundary]', error?.message, info?.componentStack?.split('\n')?.[1]?.trim());
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.message}>The app encountered an unexpected error.</Text>
        <TouchableOpacity
          style={s.btn}
          onPress={() => this.setState({ hasError: false, message: '' })}
        >
          <Text style={s.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F17', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  message: { color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: { backgroundColor: '#C9A84C', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28 },
  btnText: { color: '#0A0F17', fontWeight: '800', fontSize: 16 },
});
