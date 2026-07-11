import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '@/stores/auth'

/**
 * Reusable wallet connect + auth flow.
 * Pass a router location as `redirect` to navigate there automatically
 * after authentication succeeds.
 */
export function useWalletConnect() {
  const router = useRouter()
  const auth = useAuthStore()

  async function connect(redirect = null) {
    const result = await auth.authenticate()
    if (!result.success) {
      if (result.reason === 'no_provider') {
        message.error('Please install MetaMask in your browser.')
      } else if (result.reason === 'auth_failed') {
        message.error('Authentication failed or was rejected')
      }
    } else if (redirect) {
      router.push(redirect)
    }
    return result
  }

  return { connect }
}
