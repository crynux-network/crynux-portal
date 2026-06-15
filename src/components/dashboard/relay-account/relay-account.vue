<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useAuthStore } from '@/stores/auth'
import config from '@/config.json'
import { ethers } from 'ethers'
import beneficialAbi from '@/abi/beneficial-address.json'
import { QuestionCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { walletAPI } from '@/api/v1/wallet'
import v2RelayAccountAPI from '@/api/v2/relay-account'
import RelayAccountIncomeChart from '@/components/relay-account-income-chart.vue'
import RelayAccountEmissionChart from '@/components/relay-account-emission-chart.vue'
import moment from 'moment'
import NetworkTag from '@/components/network-tag.vue'
import { createReadProvider, isUserRejectedError, getBeneficialAddress, isZeroAddress } from '@/services/contract'
import { formatBigInt18, formatBigInt18Precise, toBigInt } from '@/services/token'
import { getDelegatorTotalStakeAmount } from '@/services/delegated-staking'
import { getStakingInfo as getNodeStakingInfo, tryUnstake, forceUnstake, StakingStatus } from '@/services/node-staking'
import {
    formatNetworkName as formatConfiguredNetworkName,
    getAllWalletNetworks,
    getFundingNetworkConfig,
    getFundingNetworks,
    getNetworkConfig,
    isSystemNetwork
} from '@/services/network-config'

const wallet = useWalletStore()
const auth = useAuthStore()

const erc20Abi = [
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address recipient, uint256 amount) returns (bool)'
]

const getTokenAddress = (network) => network?.token_address || network?.contracts?.tokenAddress

const networkName = computed(() => {
	const key = wallet.selectedOnChainWalletNetworkKey
	return formatConfiguredNetworkName(key)
})

const beneficialAddressContractAddress = computed(() => {
    const network = getNetworkConfig(wallet.selectedOnChainWalletNetworkKey)
    return network?.contracts?.beneficialAddress || network?.benefit_address
})

const onChainWalletNetworkOptions = computed(() => Object.entries(getAllWalletNetworks()).map(([key, network]) => ({
    key,
    name: network.chainName || formatConfiguredNetworkName(key)
})))

const fundingNetworkOptions = computed(() => Object.entries(getFundingNetworks()).map(([key, network]) => ({
    key,
    name: network.chainName || formatConfiguredNetworkName(key)
})))

const selectedFundingNetwork = computed(() => getFundingNetworkConfig(wallet.selectedDepositWithdrawNetworkKey))
const selectedFundingNetworkName = computed(() => formatConfiguredNetworkName(wallet.selectedDepositWithdrawNetworkKey))
const selectedFundingTokenType = computed(() => selectedFundingNetwork.value?.token_type || 'native')
const selectedFundingNativeSymbol = computed(() => selectedFundingNetwork.value?.nativeCurrency?.symbol || 'native token')
const selectedFundingDecimals = computed(() => selectedFundingNetwork.value?.nativeCurrency?.decimals ?? 18)
const hasFundingErc20Token = computed(() => selectedFundingTokenType.value === 'erc20')
const selectedOnChainWalletNetwork = computed(() => getNetworkConfig(wallet.selectedOnChainWalletNetworkKey))
const selectedOnChainTokenType = computed(() => selectedOnChainWalletNetwork.value?.token_type || 'native')
const selectedOnChainNativeSymbol = computed(() => selectedOnChainWalletNetwork.value?.nativeCurrency?.symbol || '')
const hasOnChainErc20Token = computed(() => selectedOnChainTokenType.value === 'erc20')
const selectedOnChainIsSystemNetwork = computed(() => isSystemNetwork(wallet.selectedOnChainWalletNetworkKey))

const fundingNativeBalanceWei = ref('0x0')
const fundingTokenBalanceWei = ref('0x0')
const onChainNativeBalanceWei = ref('0x0')
const formattedBalance = computed(() => {
	return formatBigInt18Precise(toBigInt(onChainNativeBalanceWei.value || '0x0'))
})
const onChainTokenBalanceWei = ref('0x0')
const formattedOnChainCnxBalance = computed(() => {
    const balance = hasOnChainErc20Token.value ? onChainTokenBalanceWei.value : onChainNativeBalanceWei.value
    return formatBigInt18Precise(toBigInt(balance || '0x0'))
})
const nativeBalanceLabel = computed(() => {
    const symbol = selectedOnChainNativeSymbol.value
    return symbol ? `${symbol} Balance` : 'Native Token Balance'
})

const benefitBalanceWei = ref('0x0')
const formattedBenefitBalance = computed(() => {
	return formatBigInt18Precise(toBigInt(benefitBalanceWei.value || '0x0'))
})

const nodeStakedBalanceWei = ref('0x0')
const nodeStakingStatus = ref(0)
const nodeUnstakeTimestamp = ref(0n)
const formattedNodeStakedBalance = computed(() => {
    return formatBigInt18Precise(toBigInt(nodeStakedBalanceWei.value || '0x0'))
})
const isFetchingStake = ref(false)
const hasStakeInfoLoaded = ref(false)
const isNodeUnstaking = ref(false)

const FORCE_UNSTAKE_DELAY_SECONDS = 30 * 60

const hasNodeStake = computed(() => {
    const balance = toBigInt(nodeStakedBalanceWei.value || '0x0')
    return balance > 0n
})

const canTryUnstake = computed(() => {
    return hasNodeStake.value && nodeStakingStatus.value === StakingStatus.STAKED
})

const canForceUnstake = computed(() => {
    if (nodeStakingStatus.value !== StakingStatus.PENDING_UNSTAKE) return false
    const now = BigInt(Math.floor(Date.now() / 1000))
    const threshold = nodeUnstakeTimestamp.value + BigInt(FORCE_UNSTAKE_DELAY_SECONDS)
    return now >= threshold
})

const isPendingUnstake = computed(() => {
    return nodeStakingStatus.value === StakingStatus.PENDING_UNSTAKE && !canForceUnstake.value
})

const forceUnstakeAvailableTime = computed(() => {
    if (nodeStakingStatus.value !== StakingStatus.PENDING_UNSTAKE) return ''
    const threshold = Number(nodeUnstakeTimestamp.value) + FORCE_UNSTAKE_DELAY_SECONDS
    return moment.unix(threshold).format('YYYY-MM-DD HH:mm:ss')
})

const pendingUnstakeTooltip = computed(() => {
    if (!isPendingUnstake.value) return ''
    return `Unstake request is being processed. If not completed automatically, you can force unstake after ${forceUnstakeAvailableTime.value}.`
})

const delegatedStakedBalance = ref(0n)
const formattedDelegatedStakedBalance = computed(() => {
    return formatBigInt18Precise(delegatedStakedBalance.value)
})
const isFetchingDelegatedStake = ref(false)
const hasDelegatedStakeLoaded = ref(false)

const abi = beneficialAbi

const benefitAddress = ref('')
const withdrawBenefitAddress = ref('')
const isFetchingBenefit = ref(false)
const isFetchingOnChainBalances = ref(false)
const isFetchingFundingBalances = ref(false)

const isOnChainWalletLoading = computed(() => {
    return isFetchingOnChainBalances.value || isFetchingBenefit.value || !hasStakeInfoLoaded.value || !hasDelegatedStakeLoaded.value
})
const isModalOpen = ref(false)
const inputBenefitAddress = ref('')
const isSubmitting = ref(false)
const benefitError = ref('')
const relayBalance = ref(0)
const lockedVestingWei = ref('0')
const isLockedVestingLoading = ref(false)
const formattedLockedVesting = computed(() => {
    return formatBigInt18(toBigInt(lockedVestingWei.value || '0'), 2)
})

const isVestingOpen = ref(false)
const vestings = ref([])
const vestingsLoading = ref(false)
const vestingsPagination = ref({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: false,
})

const isWithdrawOpen = ref(false)
const withdrawFormRef = ref()
const withdrawModel = reactive({ amount: null })
const isWithdrawSubmitting = ref(false)

// Deposit state
const isDepositOpen = ref(false)
const depositFormRef = ref()
const depositModel = reactive({ amount: null })
const isDepositSubmitting = ref(false)
const depositAddress = computed(() => String(config.deposit_address).trim())
const minDepositCNX = computed(() => {
    const n = Number(selectedFundingNetwork.value?.deposit_min ?? config.deposit_min)
    return Math.floor(n)
})
const depositBalanceWei = computed(() => hasFundingErc20Token.value ? fundingTokenBalanceWei.value : fundingNativeBalanceWei.value)
const maxDepositCNX = computed(() => {
    return Math.max(0, Math.floor(Number(ethers.formatUnits(depositBalanceWei.value || '0x0', selectedFundingDecimals.value))))
})
const isFundingErc20WithoutGas = computed(() => hasFundingErc20Token.value && toBigInt(fundingNativeBalanceWei.value || '0x0') === 0n)
const isDepositInputDisabled = computed(() => maxDepositCNX.value < minDepositCNX.value || isFundingErc20WithoutGas.value)
const depositDisabledMessage = computed(() => {
    const messages = []
    if (maxDepositCNX.value < minDepositCNX.value) {
        messages.push(`Your CNX balance on ${selectedFundingNetworkName.value} is below the minimum deposit amount of ${formatInt(minDepositCNX.value)} CNX.`)
    }
    if (isFundingErc20WithoutGas.value) {
        messages.push(`Your ${selectedFundingNativeSymbol.value} balance is 0. Add ${selectedFundingNativeSymbol.value} to pay network fees before depositing CNX.`)
    }
    return messages.join(' ')
})
const hasDepositValue = computed(() => depositModel.amount !== null && depositModel.amount !== undefined && depositModel.amount !== '')
const depositAmountError = computed(() => {
    if (!hasDepositValue.value) return ''
    const amt = Number(depositModel.amount)
    if (!Number.isInteger(amt)) return 'Amount must be an integer'
    if (amt < minDepositCNX.value) return `Minimum is ${minDepositCNX.value} CNX`
    if (amt > maxDepositCNX.value) return 'Exceeds maximum available'
    return ''
})
const depositValidateStatus = computed(() => (depositDisabledMessage.value || depositAmountError.value ? 'error' : undefined))
const depositHelpMessage = computed(() => (depositDisabledMessage.value || depositAmountError.value || undefined))
const isDepositValid = computed(() => {
    if (isDepositInputDisabled.value) return false
    if (!hasDepositValue.value) return false
    return !depositAmountError.value
})
const depositRules = {
    amount: [
        {
            validator: (_rule, value) => {
                const amt = Number(value)
                const min = Number(minDepositCNX.value || 0)
                if (value === null || value === undefined || value === '') return Promise.reject('Enter amount')
                if (!Number.isInteger(amt)) return Promise.reject('Amount must be an integer')
                if (amt < min) return Promise.reject(`Minimum is ${min} CNX`)
                if (amt > maxDepositCNX.value) return Promise.reject('Exceeds maximum available')
                return Promise.resolve()
            },
            trigger: ['change', 'blur']
        }
    ]
}

const withdrawRules = {
    amount: [
        {
            validator: (_rule, value) => {
                const amt = Number(value)
                const min = Number(minWithdrawCNX.value || 0)
                const max = Math.max(0, Math.floor((Number(relayBalance.value || 0)) - withdrawalFeeInt.value))
                if (value === null || value === undefined || value === '') return Promise.reject('Enter amount')
                if (!Number.isInteger(amt)) return Promise.reject('Amount must be an integer')
                if (amt < min) return Promise.reject(`Minimum is ${min} CNX`)
                if (amt > max) return Promise.reject('Exceeds maximum available')
                return Promise.resolve()
            },
            trigger: ['change', 'blur']
        }
    ]
}

const withdrawalFeeCNX = computed(() => {
    const n = Number(selectedFundingNetwork.value?.withdrawal_fee ?? config.withdrawal_fee ?? 0)
    return isNaN(n) ? 0 : n
})

const withdrawalFeeInt = computed(() => {
    return Math.round(withdrawalFeeCNX.value)
})

const actualDeductionCNX = computed(() => {
    const amt = Number(withdrawModel.amount || 0)
    const fee = withdrawalFeeCNX.value
    if (isNaN(amt) || isNaN(fee)) return 0
    return amt + fee
})

const actualDeductionInt = computed(() => {
    return Math.round(actualDeductionCNX.value)
})

const minWithdrawCNX = computed(() => {
    const n = Number(selectedFundingNetwork.value?.withdrawal_min ?? config.withdrawal_min ?? 0)
    return isNaN(n) ? 0 : Math.floor(n)
})
const maxWithdrawCNX = computed(() => {
    const bal = Number(relayBalance.value || 0)
    const max = Math.floor(bal - withdrawalFeeInt.value)
    return Math.max(0, max)
})
const isAmountInputDisabled = computed(() => maxWithdrawCNX.value < minWithdrawCNX.value)

const formatInt = (n) => {
    const num = Number(n || 0)
    const v = Math.max(0, Math.floor(num))
    try { return v.toLocaleString('en-US') } catch { return String(v) }
}

const formatTokenAmountWei = (value) => {
    return `CNX ${formatBigInt18(toBigInt(value || '0'), 2)}`
}

const destinationAddress = computed(() => {
    if (withdrawBenefitAddress.value && !isZeroAddress(withdrawBenefitAddress.value)) return withdrawBenefitAddress.value
    return wallet.address || ''
})

const receivingTypeLabel = computed(() => {
    return (withdrawBenefitAddress.value && !isZeroAddress(withdrawBenefitAddress.value)) ? 'Beneficial' : 'Operational'
})

const receivingTagColor = computed(() => {
    return (withdrawBenefitAddress.value && !isZeroAddress(withdrawBenefitAddress.value)) ? 'green' : 'red'
})

const isWithdrawValid = computed(() => {
    const amtRaw = withdrawModel.amount
    if (amtRaw === null || amtRaw === undefined || amtRaw === '') return false
    const amt = Number(amtRaw)
    if (!Number.isInteger(amt)) return false
    if (amt < minWithdrawCNX.value) return false
    if (amt > maxWithdrawCNX.value) return false
    try { return ethers.isAddress(destinationAddress.value) } catch { return false }
})

const isAmountFieldValid = computed(() => {
    const amtRaw = withdrawModel.amount
    if (amtRaw === null || amtRaw === undefined || amtRaw === '') return false
    const amt = Number(amtRaw)
    if (!Number.isInteger(amt)) return false
    if (amt < minWithdrawCNX.value) return false
    if (amt > maxWithdrawCNX.value) return false
    return true
})

const withdrawals = ref([])
const withdrawalsPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
})
const withdrawalsLoading = ref(false)

const deposits = ref([])
const depositsPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
})
const depositsLoading = ref(false)
const withdrawalColumns = [
  {
    title: "Created At",
    dataIndex: "time",
    key: "time",
  },
  {
    title: "Amount",
    dataIndex: "amount",
    key: "amount",
  },
  {
    title: "Fee",
    dataIndex: "withdrawal_fee",
    key: "withdrawal_fee",
  },
  {
    title: "Network",
    dataIndex: "network",
    key: "network",
  },
  {
    title: "To Address",
    dataIndex: "to_type",
    key: "to_type",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
  },
  {
    title: "Tx Hash",
    dataIndex: "tx_hash",
    key: "tx_hash",
  },
]

const depositColumns = [
  {
    title: "Created At",
    dataIndex: "time",
    key: "time",
  },
  {
    title: "Amount",
    dataIndex: "amount",
    key: "amount",
  },
  {
    title: "Network",
    dataIndex: "network",
    key: "network",
  },
  {
    title: "Tx Hash",
    dataIndex: "tx_hash",
    key: "tx_hash",
  },
]

const vestingColumns = [
  {
    title: "Total Amount",
    dataIndex: "total_amount",
    key: "total_amount",
  },
  {
    title: "Start Time",
    dataIndex: "start_time",
    key: "start_time",
  },
  {
    title: "Lock Duration",
    dataIndex: "duration_days",
    key: "duration_days",
  },
  {
    title: "Released Amount",
    dataIndex: "released_amount",
    key: "released_amount",
  },
  {
    title: "Remaining Amount",
    dataIndex: "remaining_amount",
    key: "remaining_amount",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
  },
]

const truncateTxHash = (h) => {
	if (!h) return ''
	const s = String(h)
	if (s.length <= 18) return s
	return s.slice(0, 10) + '...' + s.slice(-8)
}

const formatNetworkName = (n) => formatConfiguredNetworkName(n)

let dashboardRefreshId = 0
let onChainBalanceRequestId = 0
let fundingBalanceRequestId = 0

const isSameAddress = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase()

const isCurrentOnChainRequest = (address, networkKey) => {
    return isSameAddress(wallet.address, address) && wallet.selectedOnChainWalletNetworkKey === networkKey
}

const isCurrentFundingRequest = (address, networkKey) => {
    return isSameAddress(wallet.address, address) && wallet.selectedDepositWithdrawNetworkKey === networkKey
}

const resetOnChainWalletState = () => {
    benefitAddress.value = ''
    benefitBalanceWei.value = '0x0'
    onChainNativeBalanceWei.value = '0x0'
    onChainTokenBalanceWei.value = '0x0'
    nodeStakedBalanceWei.value = '0x0'
    nodeStakingStatus.value = 0
    nodeUnstakeTimestamp.value = 0n
    hasStakeInfoLoaded.value = false
    delegatedStakedBalance.value = 0n
    hasDelegatedStakeLoaded.value = false
}

const resetFundingBalances = () => {
    fundingNativeBalanceWei.value = '0x0'
    fundingTokenBalanceWei.value = '0x0'
}

const formatTimestamp = (t) => {
	if (t === undefined || t === null || t === '') return ''
	const n = Number(t)
	if (!Number.isFinite(n)) return String(t)
	const seconds = n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
	return moment.unix(seconds).format('YYYY-MM-DD HH:mm')
}

const formatDate = (t) => {
	if (t === undefined || t === null || t === '') return ''
	const n = Number(t)
	if (!Number.isFinite(n)) return String(t)
	const seconds = n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
	return moment.unix(seconds).format('YYYY-MM-DD')
}

async function refreshDashboard() {
    const refreshId = ++dashboardRefreshId
	if (!wallet.address) {
        resetFundingBalances()
        resetOnChainWalletState()
		relayBalance.value = 0
		withdrawals.value = []
		deposits.value = []
        lockedVestingWei.value = '0'
        vestings.value = []
        vestingsPagination.value.current = 1
        vestingsPagination.value.total = 0
        isVestingOpen.value = false
		return
	}
	const sessionAddr = auth.sessionAddress || null
	const hasMismatch = !!(sessionAddr && sessionAddr.toLowerCase() !== String(wallet.address).toLowerCase())
    await fetchFundingBalances()
    if (refreshId !== dashboardRefreshId) return
    await fetchOnChainBalances()
    if (refreshId !== dashboardRefreshId) return
	if (!auth.isAuthenticated || hasMismatch) {
		benefitAddress.value = ''
        benefitBalanceWei.value = '0x0'
		relayBalance.value = 0
        nodeStakedBalanceWei.value = '0x0'
        nodeStakingStatus.value = 0
        nodeUnstakeTimestamp.value = 0n
        hasStakeInfoLoaded.value = false
        delegatedStakedBalance.value = 0n
        hasDelegatedStakeLoaded.value = false
		withdrawals.value = []
		deposits.value = []
        lockedVestingWei.value = '0'
        vestings.value = []
        vestingsPagination.value.current = 1
        vestingsPagination.value.total = 0
        isVestingOpen.value = false
		return
	}
    await fetchBenefitAddress()
    if (refreshId !== dashboardRefreshId) return
    if (benefitAddress.value && !isZeroAddress(benefitAddress.value)) {
        await fetchBenefitBalance()
        if (refreshId !== dashboardRefreshId) return
    } else {
        benefitBalanceWei.value = '0x0'
    }
    await fetchNodeStakingInfo()
    if (refreshId !== dashboardRefreshId) return
    await fetchDelegatedStakingInfo()
    if (refreshId !== dashboardRefreshId) return
    await fetchLockedVesting()
    if (refreshId !== dashboardRefreshId) return
	await fetchRelayBalance()
    if (refreshId !== dashboardRefreshId) return
	await getWithdrawals(withdrawalsPagination.value.current, withdrawalsPagination.value.pageSize)
    if (refreshId !== dashboardRefreshId) return
	await getDeposits(depositsPagination.value.current, depositsPagination.value.pageSize)
}

const getWithdrawals = async (page = 1, pageSize = 10) => {
	if (!wallet.address) {
		return;
	}
	withdrawalsLoading.value = true;
	try {
		const res = await walletAPI.getWithdrawals(wallet.address, page, pageSize);
		withdrawals.value = res.withdraw_records.map((record) => {
			const hasAmount = record && record.amount !== undefined && record.amount !== null
			let formattedAmount = ''
			if (hasAmount) {
				try {
					const amt = Number(ethers.formatEther(record.amount))
					formattedAmount = formatInt(Math.round(amt))
				} catch {
					formattedAmount = ''
				}
			}
			const rawFee = record && record.withdrawal_fee
			const hasFee = rawFee !== undefined && rawFee !== null
			let formattedFee = ''
			if (hasFee) {
				try {
					const feeNum = Number(ethers.formatEther(rawFee))
					formattedFee = formatInt(Math.round(feeNum))
				} catch {
					formattedFee = ''
				}
			}
			const benefitAddrStr = String((record && record.benefit_address) || '').trim()
			const opAddrStr = String(wallet.address || '').trim()
			const isBeneficial = benefitAddrStr !== '' && benefitAddrStr.toLowerCase() !== opAddrStr.toLowerCase()
			const toType = isBeneficial ? 'Beneficial' : 'Operational'
			const toTypeColor = isBeneficial ? 'green' : 'red'
			return {
				...record,
				time: formatTimestamp(record && (record.created_at)),
				amount: hasAmount ? ("CNX " + formattedAmount) : '',
				withdrawal_fee: hasFee ? ("CNX " + formattedFee) : '',
				network: formatNetworkName((record && record.network) || ''),
				status: (record && (record.status ?? '')),
				to_type: toType,
				to_type_color: toTypeColor,
				tx_hash: (record && (record.tx_hash)) || '',
			}
		});
		withdrawalsPagination.value.total = res.total;
		withdrawalsPagination.value.current = page;
	} catch (e) {
		message.error(e.message);
	} finally {
		withdrawalsLoading.value = false;
	}
}

const handleWithdrawalsTableChange = (pagination) => {
  getWithdrawals(pagination.current, pagination.pageSize);
}

const getDeposits = async (page = 1, pageSize = 10) => {
	if (!wallet.address) {
		return;
	}
	depositsLoading.value = true;
	try {
		const res = await walletAPI.getDeposits(wallet.address, page, pageSize);
		deposits.value = res.deposit_records.map((record) => {
			const hasAmount = record && record.amount !== undefined && record.amount !== null
			let formattedAmount = ''
			if (hasAmount) {
				try {
					const amt = Number(ethers.formatEther(record.amount))
					formattedAmount = formatInt(Math.round(amt))
				} catch {
					formattedAmount = ''
				}
			}
			return {
				...record,
				time: formatTimestamp(record && (record.created_at)),
				amount: hasAmount ? ("CNX " + formattedAmount) : '',
				network: formatNetworkName((record && record.network) || ''),
				tx_hash: (record && (record.tx_hash)) || '',
			}
		});
		depositsPagination.value.total = res.total;
		depositsPagination.value.current = page;
	} catch (e) {
		message.error(e.message);
	} finally {
		depositsLoading.value = false;
	}
}

const handleDepositsTableChange = (pagination) => {
  getDeposits(pagination.current, pagination.pageSize);
}

const fetchLockedVesting = async () => {
    if (!wallet.address) {
        lockedVestingWei.value = '0'
        return
    }
    isLockedVestingLoading.value = true
    try {
        const res = await v2RelayAccountAPI.getLockedVesting(wallet.address)
        lockedVestingWei.value = toBigInt(res || '0').toString()
    } catch (e) {
        lockedVestingWei.value = '0'
        message.error(e.message || 'Failed to fetch locked vesting amount')
    } finally {
        isLockedVestingLoading.value = false
    }
}

const getVestings = async (page = 1, pageSize = 20) => {
    if (!wallet.address) {
        vestings.value = []
        return
    }
    vestingsLoading.value = true
    try {
        const res = await v2RelayAccountAPI.getVestings(wallet.address, page, pageSize)
        vestings.value = (res.vesting_records || []).map((record) => ({
            ...record,
            slashed: record && record.slashed === true,
            start_time: formatDate(record && record.start_time),
            duration_days: `${record && record.duration_days ? record.duration_days : 0} days`,
            total_amount: formatTokenAmountWei(record && record.total_amount),
            released_amount: formatTokenAmountWei(record && record.released_amount),
            remaining_amount: formatTokenAmountWei(record && record.remaining_amount),
        }))
        vestingsPagination.value.total = res.total || 0
        vestingsPagination.value.current = page
    } catch (e) {
        message.error(e.message || 'Failed to fetch vesting records')
    } finally {
        vestingsLoading.value = false
    }
}

const handleVestingsTableChange = (pagination) => {
    getVestings(pagination.current, pagination.pageSize)
}

const openVestingModal = async () => {
    if (!wallet.address || !auth.isAuthenticated) {
        return
    }
    const sessionAddr = auth.sessionAddress || null
    if (sessionAddr && sessionAddr.toLowerCase() !== String(wallet.address).toLowerCase()) {
        return
    }
    isVestingOpen.value = true
    await fetchLockedVesting()
    await getVestings(vestingsPagination.value.current, vestingsPagination.value.pageSize)
}

const fetchRelayBalance = async () => {
    if (!wallet.address) {
        relayBalance.value = 0
        return
    }
    try {
        const balanceInWei = await walletAPI.getRelayAccount(wallet.address)
        relayBalance.value = parseFloat(ethers.formatEther(balanceInWei || '0'))
    } catch (e) {
        console.error(e)
        relayBalance.value = 0
        message.error('Failed to fetch relay account balance')
    }
}

const fetchBenefitAddress = async () => {
	benefitError.value = ''
	isFetchingBenefit.value = true
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
	if (!address) {
		benefitAddress.value = ''
		isFetchingBenefit.value = false
		return
	}
	try {
		const addr = await getBeneficialAddress(networkKey, address)
        if (isCurrentOnChainRequest(address, networkKey)) {
            benefitAddress.value = addr
        }
	} catch (e) {
		console.error(e)
        if (isCurrentOnChainRequest(address, networkKey)) {
		    benefitAddress.value = ''
		    benefitError.value = 'Failed to load. Please refresh the page.'
        }
	} finally {
        if (isCurrentOnChainRequest(address, networkKey)) {
		    isFetchingBenefit.value = false
        }
	}
}

const fetchWithdrawBenefitAddress = async () => {
    if (!wallet.address) {
        withdrawBenefitAddress.value = ''
        return
    }
    withdrawBenefitAddress.value = await getBeneficialAddress(wallet.selectedDepositWithdrawNetworkKey, wallet.address)
}

const fetchBenefitBalance = async () => {
	const addr = benefitAddress.value
	if (!addr || isZeroAddress(addr)) return
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
    const network = getNetworkConfig(networkKey)
    const tokenAddress = getTokenAddress(network)
    const tokenType = network?.token_type || 'native'
	try {
		const provider = createReadProvider(networkKey)
        if (tokenType === 'erc20') {
            if (!tokenAddress) {
                if (isCurrentOnChainRequest(address, networkKey)) {
                    benefitBalanceWei.value = '0x0'
                }
                return
            }
            const contract = new ethers.Contract(tokenAddress, erc20Abi, provider)
            const balance = await contract.balanceOf(addr)
            if (isCurrentOnChainRequest(address, networkKey)) {
                benefitBalanceWei.value = '0x' + balance.toString(16)
            }
            return
        }
		const balance = await provider.getBalance(addr)
        if (isCurrentOnChainRequest(address, networkKey)) {
		    benefitBalanceWei.value = '0x' + balance.toString(16)
        }
	} catch (e) {
		console.error('Failed to fetch beneficial address CNX balance:', e)
        if (isCurrentOnChainRequest(address, networkKey)) {
            benefitBalanceWei.value = '0x0'
        }
	}
}

const fetchOnChainNativeBalance = async () => {
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
    if (!address) {
        onChainNativeBalanceWei.value = '0x0'
        return
    }
    try {
        const provider = createReadProvider(networkKey)
        const balance = await provider.getBalance(address)
        if (isCurrentOnChainRequest(address, networkKey)) {
            onChainNativeBalanceWei.value = '0x' + balance.toString(16)
        }
    } catch (e) {
        console.error('Failed to fetch native balance:', e)
        if (isCurrentOnChainRequest(address, networkKey)) {
            onChainNativeBalanceWei.value = '0x0'
        }
    }
}

const fetchOnChainTokenBalance = async () => {
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
    const network = getNetworkConfig(networkKey)
    const tokenType = network?.token_type || 'native'
    if (!address || tokenType !== 'erc20') {
        onChainTokenBalanceWei.value = '0x0'
        return
    }
    const tokenAddress = getTokenAddress(network)
    if (!tokenAddress) {
        onChainTokenBalanceWei.value = '0x0'
        return
    }
    try {
        const provider = createReadProvider(networkKey)
        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider)
        const balance = await contract.balanceOf(address)
        if (isCurrentOnChainRequest(address, networkKey)) {
            onChainTokenBalanceWei.value = '0x' + balance.toString(16)
        }
    } catch (e) {
        console.error('Failed to fetch token balance:', e)
        if (isCurrentOnChainRequest(address, networkKey)) {
            onChainTokenBalanceWei.value = '0x0'
        }
    }
}

const fetchFundingNativeBalance = async () => {
    const address = wallet.address
    const networkKey = wallet.selectedDepositWithdrawNetworkKey
    if (!address) {
        fundingNativeBalanceWei.value = '0x0'
        return
    }
    try {
        const provider = createReadProvider(networkKey)
        const balance = await provider.getBalance(address)
        if (isCurrentFundingRequest(address, networkKey)) {
            fundingNativeBalanceWei.value = '0x' + balance.toString(16)
        }
    } catch (e) {
        console.error('Failed to fetch funding native balance:', e)
        if (isCurrentFundingRequest(address, networkKey)) {
            fundingNativeBalanceWei.value = '0x0'
        }
    }
}

const fetchFundingTokenBalance = async () => {
    const address = wallet.address
    const networkKey = wallet.selectedDepositWithdrawNetworkKey
    const network = getFundingNetworkConfig(networkKey)
    const tokenType = network?.token_type || 'native'
    if (!address || tokenType !== 'erc20') {
        fundingTokenBalanceWei.value = '0x0'
        return
    }
    const tokenAddress = getTokenAddress(network)
    if (!tokenAddress) {
        fundingTokenBalanceWei.value = '0x0'
        return
    }
    try {
        const provider = createReadProvider(networkKey)
        const contract = new ethers.Contract(tokenAddress, erc20Abi, provider)
        const balance = await contract.balanceOf(address)
        if (isCurrentFundingRequest(address, networkKey)) {
            fundingTokenBalanceWei.value = '0x' + balance.toString(16)
        }
    } catch (e) {
        console.error('Failed to fetch funding token balance:', e)
        if (isCurrentFundingRequest(address, networkKey)) {
            fundingTokenBalanceWei.value = '0x0'
        }
    }
}

const fetchFundingBalances = async () => {
    const requestId = ++fundingBalanceRequestId
    isFetchingFundingBalances.value = true
    try {
        await fetchFundingNativeBalance()
        if (requestId !== fundingBalanceRequestId) return
        await fetchFundingTokenBalance()
    } finally {
        if (requestId === fundingBalanceRequestId) {
            isFetchingFundingBalances.value = false
        }
    }
}

const fetchOnChainBalances = async () => {
    const requestId = ++onChainBalanceRequestId
    isFetchingOnChainBalances.value = true
    try {
        await fetchOnChainNativeBalance()
        if (requestId !== onChainBalanceRequestId) return
        await fetchOnChainTokenBalance()
    } finally {
        if (requestId === onChainBalanceRequestId) {
            isFetchingOnChainBalances.value = false
        }
    }
}

const fetchNodeStakingInfo = async () => {
    hasStakeInfoLoaded.value = false
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
    const isSystem = isSystemNetwork(networkKey)
    if (!address) {
        nodeStakedBalanceWei.value = '0x0'
        nodeStakingStatus.value = 0
        nodeUnstakeTimestamp.value = 0n
        return
    }
    isFetchingStake.value = true
    try {
        if (!isSystem) {
            nodeStakedBalanceWei.value = '0x0'
            nodeStakingStatus.value = 0
            nodeUnstakeTimestamp.value = 0n
            return
        }
        const info = await getNodeStakingInfo(networkKey, address)
        if (!isCurrentOnChainRequest(address, networkKey)) {
            return
        }
        let balanceHex = '0x0'
        try {
            balanceHex = '0x' + info.stakedBalance.toString(16)
        } catch {
            balanceHex = '0x0'
        }
        nodeStakedBalanceWei.value = balanceHex
        nodeStakingStatus.value = info.status
        nodeUnstakeTimestamp.value = info.unstakeTimestamp
    } catch (e) {
        console.error('Failed to fetch node staking info:', e)
        if (isCurrentOnChainRequest(address, networkKey)) {
            nodeStakedBalanceWei.value = '0x0'
            nodeStakingStatus.value = 0
            nodeUnstakeTimestamp.value = 0n
        }
    } finally {
        if (isCurrentOnChainRequest(address, networkKey)) {
            isFetchingStake.value = false
            hasStakeInfoLoaded.value = true
        }
    }
}

const fetchDelegatedStakingInfo = async () => {
    hasDelegatedStakeLoaded.value = false
    const address = wallet.address
    const networkKey = wallet.selectedOnChainWalletNetworkKey
    const isSystem = isSystemNetwork(networkKey)
    if (!address) {
        delegatedStakedBalance.value = 0n
        return
    }
    isFetchingDelegatedStake.value = true
    try {
        if (!isSystem) {
            delegatedStakedBalance.value = 0n
            return
        }
        const res = await getDelegatorTotalStakeAmount(networkKey, address)
        if (isCurrentOnChainRequest(address, networkKey)) {
            delegatedStakedBalance.value = res
        }
    } catch (e) {
        console.error(e)
        if (isCurrentOnChainRequest(address, networkKey)) {
            delegatedStakedBalance.value = 0n
        }
    } finally {
        if (isCurrentOnChainRequest(address, networkKey)) {
            isFetchingDelegatedStake.value = false
            hasDelegatedStakeLoaded.value = true
        }
    }
}

const openSetModal = () => {
	inputBenefitAddress.value = ''
	isModalOpen.value = true
}

const submitSetBenefit = async () => {
	if (!window.ethereum) {
		message.error('No wallet provider')
		return
	}
	if (!beneficialAddressContractAddress.value) {
		message.error('Contract not configured')
		return
	}
	if (!ethers.isAddress(inputBenefitAddress.value)) {
		message.error('Invalid address')
		return
	}
	isSubmitting.value = true
	try {
		await wallet.ensureNetworkOnWallet(wallet.selectedOnChainWalletNetworkKey)
		const provider = new ethers.BrowserProvider(window.ethereum)
		const signer = await provider.getSigner()
		const contract = new ethers.Contract(beneficialAddressContractAddress.value, abi, signer)
		const tx = await contract.setBenefitAddress(inputBenefitAddress.value)
		await tx.wait()
		message.success('Beneficial address set')
		isModalOpen.value = false
		await fetchBenefitAddress()
		await fetchBenefitBalance()
	} catch (e) {
		message.error('Failed to set address')
	} finally {
		isSubmitting.value = false
	}
}

const changeOnChainWalletNetwork = async () => {
    resetOnChainWalletState()
    await wallet.ensureNetworkOnWallet(wallet.selectedOnChainWalletNetworkKey)
    await wallet.fetchBalance()
    await refreshDashboard()
}

const changeFundingNetwork = async () => {
    resetFundingBalances()
    await wallet.ensureNetworkOnWallet(wallet.selectedDepositWithdrawNetworkKey)
    await wallet.fetchBalance()
    await fetchFundingBalances()
    await fetchWithdrawBenefitAddress()
}

const withdrawRelay = async () => {
    withdrawModel.amount = null
    await fetchWithdrawBenefitAddress()
    isWithdrawOpen.value = true
}

const submitWithdraw = async () => {
    const amt = Number(withdrawModel.amount)

    const decimals = selectedFundingNetwork.value?.nativeCurrency?.decimals ?? 18
    let amountWeiStr = '0'
    try {
        amountWeiStr = ethers.parseUnits(String(amt), decimals).toString()
    } catch (_) {
        message.error('Invalid amount format')
        return
    }

    const benefitToSend = destinationAddress.value

    isWithdrawSubmitting.value = true
    try {
        await wallet.ensureNetworkOnWallet(wallet.selectedDepositWithdrawNetworkKey)
        const provider = window.ethereum
        const timestamp = Math.floor(Date.now() / 1000)
        const action = `Withdraw ${amountWeiStr} from ${wallet.address} to ${benefitToSend} on ${wallet.selectedDepositWithdrawNetworkKey}`
        const messageToSign = `Crynux Relay\nAction: ${action}\nAddress: ${wallet.address}\nTimestamp: ${timestamp}`
        const signature = await provider.request({
            method: 'personal_sign',
            params: [messageToSign, wallet.address]
        })

        await walletAPI.withdraw(
            wallet.address,
            amountWeiStr,
            benefitToSend,
            wallet.selectedDepositWithdrawNetworkKey,
            timestamp,
            signature
        )

        message.success('Withdraw submitted')
        isWithdrawOpen.value = false
        await fetchRelayBalance()
        await getWithdrawals(withdrawalsPagination.value.current, withdrawalsPagination.value.pageSize)
    } catch (e) {
        console.error('Withdraw error:', e)
        if (isUserRejectedError(e)) {
            message.error('User rejected')
        } else {
            message.error('Withdraw failed')
        }
    } finally {
        isWithdrawSubmitting.value = false
    }
}

const openDeposit = async () => {
    depositModel.amount = null
    await fetchFundingBalances()
    isDepositOpen.value = true
}

const submitDeposit = async () => {
    const amt = Number(depositModel.amount)
    const decimals = selectedFundingNetwork.value?.nativeCurrency?.decimals ?? 18
    let valueWei
    try {
        valueWei = ethers.parseUnits(String(amt), decimals)
    } catch (_) {
        message.error('Invalid amount format')
        return
    }
    isDepositSubmitting.value = true
    try {
        await wallet.ensureNetworkOnWallet(wallet.selectedDepositWithdrawNetworkKey)
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        let tx
        if (selectedFundingTokenType.value === 'erc20') {
            const tokenAddress = getTokenAddress(selectedFundingNetwork.value)
            const contract = new ethers.Contract(tokenAddress, erc20Abi, signer)
            tx = await contract.transfer(depositAddress.value, valueWei)
        } else {
            tx = await signer.sendTransaction({ to: depositAddress.value, value: valueWei })
        }
        await tx.wait()
        message.success('Deposit sent')
        isDepositOpen.value = false
        await wallet.fetchBalance()
        await fetchFundingBalances()
        await fetchRelayBalance()
    } catch (e) {
        console.error('Deposit error:', e)
        if (isUserRejectedError(e)) {
            message.error('User rejected')
        } else {
            message.error('Deposit failed')
        }
    } finally {
        isDepositSubmitting.value = false
    }
}

const handleTryUnstake = async () => {
    if (!window.ethereum) {
        message.error('No wallet provider')
        return
    }
    isNodeUnstaking.value = true
    try {
        await tryUnstake(wallet.selectedOnChainWalletNetworkKey)
        message.success('Unstake request submitted. Refresh the page later to view the result.')
        await fetchNodeStakingInfo()
    } catch (e) {
        console.error('Try unstake error:', e)
        if (isUserRejectedError(e)) {
            message.error('Transaction rejected')
        } else {
            message.error('Unstake request failed: ' + (e.reason || e.message || 'Unknown error'))
        }
    } finally {
        isNodeUnstaking.value = false
    }
}

const handleForceUnstake = async () => {
    if (!window.ethereum) {
        message.error('No wallet provider')
        return
    }
    isNodeUnstaking.value = true
    try {
        await forceUnstake(wallet.selectedOnChainWalletNetworkKey)
        message.success('Force unstake completed')
        await fetchNodeStakingInfo()
        await wallet.fetchBalance()
    } catch (e) {
        console.error('Force unstake error:', e)
        if (isUserRejectedError(e)) {
            message.error('Transaction rejected')
        } else {
            message.error('Force unstake failed: ' + (e.reason || e.message || 'Unknown error'))
        }
    } finally {
        isNodeUnstaking.value = false
    }
}

onMounted(async () => {
	if (wallet.address) {
		await wallet.fetchBalance()
	}
	await refreshDashboard()
})

watch(() => wallet.selectedOnChainWalletNetworkKey, () => {
    resetOnChainWalletState()
})

watch(() => wallet.selectedDepositWithdrawNetworkKey, () => {
    resetFundingBalances()
})

watch(() => [wallet.address, wallet.selectedNetworkKey, wallet.selectedOnChainWalletNetworkKey, wallet.selectedDepositWithdrawNetworkKey, beneficialAddressContractAddress.value, auth.sessionToken, auth.sessionAddress], async () => {
	await refreshDashboard()
})
</script>

<template>
	<div class="top-spacer"></div>
	<a-row :gutter="[16, 16]">
		<a-col :xs="24" :lg="16" style="display: flex; flex-direction: column">
					<a-card :title="`On-chain Wallet`" :bordered="false" style="opacity: 0.9; width: 100%; flex: 1">
						<a-spin :spinning="isOnChainWalletLoading">
							<a-descriptions :column="2" bordered :label-style="{ 'width': '160px' }">
								<a-descriptions-item :span="2" label="Network">
									<a-select v-model:value="wallet.selectedOnChainWalletNetworkKey" style="min-width: 260px" @change="changeOnChainWalletNetwork">
										<a-select-option v-for="n in onChainWalletNetworkOptions" :key="n.key" :value="n.key">{{ n.name }}</a-select-option>
									</a-select>
								</a-descriptions-item>
								<a-descriptions-item :span="2" label="Address">{{ wallet.address }}</a-descriptions-item>
								<a-descriptions-item :span="2" label="CNX Balance"><span>{{ formattedOnChainCnxBalance }}</span></a-descriptions-item>
								<a-descriptions-item v-if="hasOnChainErc20Token" :span="2" :label="nativeBalanceLabel"><span>{{ formattedBalance }}</span></a-descriptions-item>
								<a-descriptions-item v-if="selectedOnChainIsSystemNetwork" label="Node Stake">
									<span>{{ formattedNodeStakedBalance }}</span>
									<template v-if="hasNodeStake && hasStakeInfoLoaded">
										<a-button
											v-if="canTryUnstake"
											type="primary"
											size="small"
											:loading="isNodeUnstaking"
											@click="handleTryUnstake"
											style="margin-left: 8px;"
										>Unstake</a-button>
										<a-button
											v-else-if="canForceUnstake"
											type="primary"
											size="small"
											:loading="isNodeUnstaking"
											@click="handleForceUnstake"
											style="margin-left: 8px;"
										>Force Unstake</a-button>
										<a-tooltip v-else-if="isPendingUnstake" :title="pendingUnstakeTooltip">
											<a-button
												type="primary"
												size="small"
												disabled
												style="margin-left: 8px;"
											>Pending Unstake</a-button>
										</a-tooltip>
									</template>
								</a-descriptions-item>
								<a-descriptions-item v-if="selectedOnChainIsSystemNetwork" label="Delegated Stake"><span>{{ formattedDelegatedStakedBalance }}</span></a-descriptions-item>
								<a-descriptions-item>
									<template #label>
										<span style="display: inline-flex; align-items: center; white-space: nowrap;">
											<span>Beneficial Address</span>
											<a-popover placement="right">
												<template #content>
													<div style="max-width: 300px;">
														<div>The beneficial address is a dedicated wallet for safely receiving your funds. For security, your operational address should not hold funds. All withdrawals, unstaking payouts, and emissions will be sent to this address. Choose a wallet you control and plan to keep using. Once set, this address is permanent and cannot be changed.</div>
														<div style="margin-top: 8px">If not set, the operational address will be used for payouts.</div>
													</div>
												</template>
												<QuestionCircleOutlined style="margin-left: 6px; color: #888; cursor: pointer;" />
											</a-popover>
										</span>
									</template>
									<div>
										<span v-if="benefitError" style="color: #d4380d;">{{ benefitError }}</span>
										<span v-else-if="benefitAddress && !isZeroAddress(benefitAddress)">
											{{ benefitAddress }}
											<span style="margin-left: 8px;">(Balance: CNX {{ formattedBenefitBalance }})</span>
										</span>
										<span v-else>
											<span style="margin-right: 8px;">Not set</span>
											<a-button type="primary" size="small" @click="openSetModal">Set Beneficial Address</a-button>
										</span>
									</div>
								</a-descriptions-item>
							</a-descriptions>
						</a-spin>
			</a-card>
		</a-col>
		<a-col :xs="24" :lg="8" style="display: flex; flex-direction: column">
					<a-card :title="`Relay Account`" :bordered="false" style="opacity: 0.9; width: 100%; flex: 1; display: flex; flex-direction: column" :body-style="{ display: 'flex', flexDirection: 'column', flex: 1, paddingBottom: '32px' }">
						<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 24px;">
                            <div style="text-align: center;">
                                <a-statistic title="Balance (CNX)" :value="relayBalance" :precision="6" :value-style="{ fontSize: '32px' }" />
                                <a-typography-text
                                    type="secondary"
                                    style="display: inline-block; margin-top: 8px; font-size: 12px; cursor: pointer;"
                                    @click="openVestingModal"
                                >
                                    <span v-if="isLockedVestingLoading">Locked Amount: Loading...</span>
                                    <span v-else>Locked Amount: {{ formattedLockedVesting }} CNX</span>
                                </a-typography-text>
                            </div>
						</div>
						<a-row :gutter="12">
							<a-col :span="12">
								<a-button block size="large" @click="openDeposit">Deposit</a-button>
							</a-col>
							<a-col :span="12">
								<a-button block type="primary" size="large" @click="withdrawRelay">Withdraw</a-button>
							</a-col>
						</a-row>
					</a-card>
		</a-col>
	</a-row>

	<a-row :gutter="[16, 16]" style="margin-top: 16px;">
		<a-col :span="24">
			<a-card :bordered="false" style="opacity: 0.9">
				<template #title>
					<span class="card-title-with-tooltip">
						Task Fee Income
						<a-tooltip title="This income only includes Node Task Fee and Delegator Task Fee. Emission rewards and Vesting unlocks are not included.">
							<QuestionCircleOutlined style="margin-left: 6px; color: #888; cursor: pointer;" />
						</a-tooltip>
					</span>
				</template>
				<RelayAccountIncomeChart :address="wallet.address" />
			</a-card>
		</a-col>
	</a-row>

	<a-row :gutter="[16, 16]" style="margin-top: 16px;">
		<a-col :span="24">
			<a-card :bordered="false" style="opacity: 0.9">
				<template #title>
					Emission Income
				</template>
				<RelayAccountEmissionChart :address="wallet.address" />
			</a-card>
		</a-col>
	</a-row>

	<a-row :gutter="[16, 16]" style="margin-top: 16px;">
		<a-col :span="24">
			<a-card :title="`Relay Account Transactions`" :bordered="false" style="opacity: 0.9">
						<a-tabs default-active-key="withdrawals" type="card">
							<a-tab-pane key="withdrawals" tab="Withdrawals">
								<a-table
									:columns="withdrawalColumns"
									:data-source="withdrawals"
									:loading="withdrawalsLoading"
									:pagination="withdrawalsPagination"
									@change="handleWithdrawalsTableChange"
									row-key="id"
								>
									<template #bodyCell="{ column, record }">
										<template v-if="column.dataIndex === 'status'">
											<a-tag v-if="record.status === 0 || record.status === '0'" color="blue">Processing</a-tag>
											<a-tag v-else-if="record.status === 1 || record.status === '1'" color="green">Success</a-tag>
											<a-tag v-else-if="record.status === 2 || record.status === '2'" color="volcano">Failed</a-tag>
											<span v-else>{{ record.status }}</span>
										</template>
										<template v-else-if="column.dataIndex === 'network'">
											<NetworkTag :text="record.network" />
										</template>
										<template v-else-if="column.dataIndex === 'to_type'">
											<a-tag :color="record.to_type_color">{{ record.to_type }}</a-tag>
										</template>
										<template v-else-if="column.dataIndex === 'tx_hash'">
											<span>{{ truncateTxHash(record.tx_hash) }}</span>
										</template>
									</template>
								</a-table>
							</a-tab-pane>
							<a-tab-pane key="deposits" tab="Deposits">
								<a-table
									:columns="depositColumns"
									:data-source="deposits"
									:loading="depositsLoading"
									:pagination="depositsPagination"
									@change="handleDepositsTableChange"
									row-key="id"
								>
									<template #bodyCell="{ column, record }">
										<template v-if="column.dataIndex === 'network'">
											<NetworkTag :text="record.network" />
										</template>
										<template v-else-if="column.dataIndex === 'tx_hash'">
											<span>{{ truncateTxHash(record.tx_hash) }}</span>
										</template>
									</template>
								</a-table>
							</a-tab-pane>
						</a-tabs>
			</a-card>
		</a-col>
	</a-row>

	<a-modal v-model:open="isModalOpen" :title="'Set Beneficial Address'" :confirm-loading="isSubmitting" @ok="submitSetBenefit" :ok-button-props="{ disabled: benefitAddress && !isZeroAddress(benefitAddress) }" :mask-closable="false">
		<a-alert type="warning" show-icon style="margin-bottom: 12px;" message="Keep the private key of this address safe and backed up." />
		<a-alert type="warning" show-icon style="margin-bottom: 12px;" message="Once set, this address cannot be changed." />
		<div v-if="benefitAddress && !isZeroAddress(benefitAddress)">
			Already set: {{ benefitAddress }}
		</div>
		<div v-else>
			<a-form layout="vertical">
				<a-form-item label="Beneficial Address">
					<a-input v-model:value="inputBenefitAddress" placeholder="0x..." />
				</a-form-item>
				<a-form-item label="Current Network">
					<NetworkTag :text="networkName" />
				</a-form-item>
			</a-form>
		</div>
	</a-modal>

	<a-modal
		v-model:open="isDepositOpen"
		:title="'Deposit'"
		:confirm-loading="isDepositSubmitting"
		@ok="submitDeposit"
		:mask-closable="false"
		:width="720"
		:ok-text="isDepositSubmitting ? 'Sending' : 'Send'"
		:cancel-button-props="{ disabled: isDepositSubmitting }"
		:closable="!isDepositSubmitting"
		:keyboard="!isDepositSubmitting"
		:ok-button-props="{ disabled: !isDepositValid }"
	>
		<template #title>
			<span>Deposit</span>
			<a-tooltip placement="right">
				<template #title>
					<span>The deposit will go into the Relay Account associated with this address.<br/>Please ensure the sending address and the target Relay Account address are the same.</span>
				</template>
				<QuestionCircleOutlined style="margin-left: 8px; color: #888;" />
			</a-tooltip>
		</template>
		<a-form layout="vertical" :model="depositModel" :rules="depositRules" ref="depositFormRef" :hide-required-mark="true" :style="{ marginTop: '24px', marginBottom: '32px' }">
			<a-form-item label="Network">
				<a-select v-model:value="wallet.selectedDepositWithdrawNetworkKey" @change="changeFundingNetwork">
					<a-select-option v-for="n in fundingNetworkOptions" :key="n.key" :value="n.key">{{ n.name }}</a-select-option>
				</a-select>
			</a-form-item>
			<a-form-item name="amount" :help="depositHelpMessage" :validate-status="depositValidateStatus" :style="{ marginBottom: '32px' }">
				<a-input-number v-model:value="depositModel.amount" :min="minDepositCNX" :step="1" :controls="false" :precision="0" style="width: 100%" placeholder="Enter amount" addon-before="CNX" :disabled="isDepositInputDisabled" />
				<template #extra>
					<a-typography-text type="secondary" style="font-size: 12px; display: block; margin-top: 12px; margin-bottom: 16px;">Min: {{ formatInt(minDepositCNX) }} CNX · Max: {{ formatInt(maxDepositCNX) }} CNX</a-typography-text>
				</template>
			</a-form-item>
		</a-form>
		<a-descriptions :column="1" bordered :label-style="{ 'width': '180px' }" :style="{ marginTop: '32px' }">
			<a-descriptions-item label="Deposit Amount">
				<a-statistic :value="isDepositValid ? Math.floor(Number(depositModel.amount)) : 0" :precision="0" :value-style="{ fontSize: '26px', color: '#1677ff' }">
					<template #suffix>
						<span style="font-size: 26px; color: #1677ff; margin-left: 4px;"> CNX</span>
					</template>
				</a-statistic>
			</a-descriptions-item>
			<a-descriptions-item>
				<template #label>
					<span style="display: inline-flex; align-items: center; white-space: nowrap;">
						<span>Send Address</span>
						<a-tooltip placement="right">
							<template #title>
								<span>The deposit will go into the Relay Account associated with this address.</span>
							</template>
							<QuestionCircleOutlined style="margin-left: 6px; color: #888; cursor: pointer;" />
						</a-tooltip>
					</span>
				</template>
				<span>{{ wallet.address }}</span>
			</a-descriptions-item>
			<a-descriptions-item label="Network">
				<NetworkTag :text="selectedFundingNetworkName" />
			</a-descriptions-item>
			<a-descriptions-item>
				<template #label>
					<span style="display: inline-flex; align-items: center; white-space: nowrap;">
						<span>Relay Address</span>
						<a-tooltip placement="right">
							<template #title>
								<span>The system wallet of the Crynux Relay that receives deposits.<br/>To prevent phishing, please verify this address in the Crynux docs or on Discord.</span>
							</template>
							<QuestionCircleOutlined style="margin-left: 6px; color: #888; cursor: pointer;" />
						</a-tooltip>
					</span>
				</template>
				<div>
					<span>{{ depositAddress }}</span>
					<a-typography-text type="danger" style="font-size: 12px; display: block; margin-top: 6px;">To prevent phishing, please verify this address in the
                        <a-typography-link :href="'https://docs.crynux.io/crynux-token/wallet-configuration#deposit-address'" target="_blank" rel="noopener noreferrer">Crynux Docs</a-typography-link> or on
                        <a-typography-link :href="config.social_links.discord" target="_blank" rel="noopener noreferrer">Discord</a-typography-link>.
                    </a-typography-text>
				</div>
			</a-descriptions-item>
		</a-descriptions>
	</a-modal>

	<a-modal
		v-model:open="isWithdrawOpen"
		:title="'Withdraw'"
		:confirm-loading="isWithdrawSubmitting"
		@ok="submitWithdraw"
		:mask-closable="false"
		:width="720"
		ok-text="Submit"
		:ok-button-props="{ disabled: !isWithdrawValid }"
	>
		<a-form layout="vertical" :model="withdrawModel" :rules="withdrawRules" ref="withdrawFormRef" :hide-required-mark="true" :style="{ marginTop: '24px', marginBottom: '32px' }">
			<a-form-item label="Network">
				<a-select v-model:value="wallet.selectedDepositWithdrawNetworkKey" @change="changeFundingNetwork">
					<a-select-option v-for="n in fundingNetworkOptions" :key="n.key" :value="n.key">{{ n.name }}</a-select-option>
				</a-select>
			</a-form-item>
			<a-form-item name="amount" :help="isAmountInputDisabled ? 'Insufficient balance to meet the minimum after fee.' : undefined" :validate-status="isAmountInputDisabled ? 'error' : undefined" :style="{ marginBottom: '32px' }">
				<a-input-number v-model:value="withdrawModel.amount" :min="minWithdrawCNX" :step="1" :controls="false" :precision="0" style="width: 100%" placeholder="Enter amount" addon-before="CNX" :disabled="isAmountInputDisabled" />
				<template #extra>
					<a-typography-text type="secondary" style="font-size: 12px; display: block; margin-top: 12px; margin-bottom: 16px;">Min: {{ formatInt(minWithdrawCNX) }} CNX · Max: {{ formatInt(maxWithdrawCNX) }} CNX</a-typography-text>
				</template>
			</a-form-item>
		</a-form>
		<a-descriptions :column="1" bordered :label-style="{ 'width': '180px' }" :style="{ marginTop: '32px' }">
			<a-descriptions-item label="Actual Deduction">
				<a-statistic :value="isAmountFieldValid ? actualDeductionInt : 0" :precision="0" :value-style="{ fontSize: '26px', color: '#1677ff' }">
					<template #suffix>
						<span style="font-size: 26px; color: #1677ff; margin-left: 4px;"> CNX</span>
						<a-typography-text type="secondary" style="font-size: 12px; margin-left: 6px;">(includes fee {{ withdrawalFeeInt }} CNX)</a-typography-text>
					</template>
				</a-statistic>
			</a-descriptions-item>
			<a-descriptions-item label="Network">
				<NetworkTag :text="selectedFundingNetworkName" />
			</a-descriptions-item>
			<a-descriptions-item label="Receiving Address">
				<a-space size="small">
					<a-tag :color="receivingTagColor">
						<CheckCircleOutlined v-if="receivingTypeLabel === 'Beneficial'" style="margin-right: 4px;" />
						<ExclamationCircleOutlined v-else style="margin-right: 4px;" />
						{{ receivingTypeLabel }}
					</a-tag>
					<span>{{ destinationAddress }}</span>
				</a-space>
			</a-descriptions-item>
		</a-descriptions>
	</a-modal>

    <a-modal
        v-model:open="isVestingOpen"
        :title="'Vesting'"
        :footer="null"
        :width="920"
        :mask-closable="true"
    >
        <a-typography-text type="secondary" style="display: block; margin-bottom: 16px;">
            Locked Amount: {{ formattedLockedVesting }} CNX
        </a-typography-text>
        <a-table
            :columns="vestingColumns"
            :data-source="vestings"
            :loading="vestingsLoading"
            :pagination="vestingsPagination"
            @change="handleVestingsTableChange"
            row-key="id"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'status'">
                    <a-tag v-if="record.slashed === true" color="volcano">Slashed</a-tag>
                    <a-tag v-else-if="record.status === 0 || record.status === '0'" color="blue">Active</a-tag>
                    <a-tag v-else-if="record.status === 1 || record.status === '1'" color="green">Completed</a-tag>
                    <span v-else>{{ record.status }}</span>
                </template>
            </template>
        </a-table>
    </a-modal>
</template>

<style scoped lang="stylus">
.top-spacer
	height 20px

.card-title-with-tooltip
	display inline-flex
	align-items center
</style>
