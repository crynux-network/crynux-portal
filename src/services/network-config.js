import config from '@/config.json'

export const getSystemNetworks = () => config.system_networks || config.networks || {}

export const getDepositWithdrawOnlyNetworks = () => Object.fromEntries(
  Object.entries(config.deposit_withdraw_networks || {}).map(([key, network]) => [
    key,
    {
      ...network,
      benefit_address: network.contracts?.beneficialAddress || network.benefit_address,
      token_address: network.contracts?.tokenAddress || network.token_address
    }
  ])
)

export const getAllWalletNetworks = () => ({
  ...getSystemNetworks(),
  ...getDepositWithdrawOnlyNetworks()
})

export const getFundingNetworks = () => {
  const systemNetworks = Object.fromEntries(
    Object.entries(getSystemNetworks()).map(([key, network]) => [
      key,
      {
        ...network,
        token_type: 'native',
        withdrawal_fee: network.withdrawal_fee ?? config.withdrawal_fee ?? 0,
        withdrawal_min: network.withdrawal_min ?? config.withdrawal_min ?? 0,
        deposit_min: network.deposit_min ?? config.deposit_min ?? 0,
        benefit_address: network.contracts?.beneficialAddress
      }
    ])
  )
  return {
    ...systemNetworks,
    ...getDepositWithdrawOnlyNetworks()
  }
}

export const getDefaultSystemNetworkKey = () => {
  const configured = config.default_network
  if (configured && getSystemNetworks()[configured]) return configured
  return Object.keys(getSystemNetworks())[0] || ''
}

export const getDefaultFundingNetworkKey = () => {
  const configured = config.default_deposit_withdraw_network || config.default_network
  if (configured && getFundingNetworks()[configured]) return configured
  return Object.keys(getFundingNetworks())[0] || ''
}

const findNetworkEntry = (networkKeyOrName) => {
  if (!networkKeyOrName) return undefined
  const raw = String(networkKeyOrName).trim()
  const normalized = raw.toLowerCase()
  const networks = getAllWalletNetworks()
  const direct = networks[raw]
  if (direct) return [raw, direct]
  return Object.entries(networks).find(([key, item]) => (
    key.toLowerCase() === normalized || String(item.chainName || '').toLowerCase() === normalized
  ))
}

const getExplorerBaseUrl = (networkKeyOrName) => {
  const network = findNetworkEntry(networkKeyOrName)?.[1]
  return String(network?.blockExplorerUrls?.[0] || '').trim().replace(/\/+$/, '')
}

export const getNetworkConfig = (networkKey) => findNetworkEntry(networkKey)?.[1]

export const getSystemNetworkConfig = (networkKey) => getSystemNetworks()[networkKey]

export const getFundingNetworkConfig = (networkKey) => getFundingNetworks()[networkKey]

export const isSystemNetwork = (networkKey) => Boolean(getSystemNetworks()[networkKey])

export const getNetworkColor = (networkKeyOrName) => {
  const network = findNetworkEntry(networkKeyOrName)?.[1]
  return network?.color
}

export const getTransactionExplorerUrl = (networkKeyOrName, txHash) => {
  const hash = String(txHash || '').trim()
  if (!hash) return ''
  const baseUrl = getExplorerBaseUrl(networkKeyOrName)
  if (!baseUrl) return ''
  return `${baseUrl}/tx/${hash}`
}

export const getAddressExplorerUrl = (networkKeyOrName, address) => {
  const value = String(address || '').trim()
  if (!value) return ''
  const baseUrl = getExplorerBaseUrl(networkKeyOrName)
  if (!baseUrl) return ''
  return `${baseUrl}/address/${value}`
}

export const formatNetworkName = (networkKey) => {
  if (!networkKey) return ''
  const raw = String(networkKey).trim()
  const network = findNetworkEntry(raw)?.[1]
  if (network?.chainName) return network.chainName
  if (raw.toLowerCase().startsWith('crynux on ')) return raw
  return `Crynux on ${raw.split('-').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')}`
}
