import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers'
import AutoLendingMarketplaceABI from '../../artifacts/AutoLendingMarketplace.abi.json'

export const CONTRACT_ADDRESS = '0x14940624C4696e93792fBE63fa42Da2aDdcAD16a'
export const CONTRACT_ABI = AutoLendingMarketplaceABI
export const ROOTSTOCK_TESTNET = {
  chainId: '0x1f', chainName: 'Rootstock Testnet',
  nativeCurrency: { name: 'Test RBTC', symbol: 'tRBTC', decimals: 18 },
  rpcUrls: ['https://public-node.testnet.rsk.co'],
  blockExplorerUrls: ['https://explorer.testnet.rootstock.io']
}
export async function connectWallet() {
  if (!window.ethereum) throw new Error('Install MetaMask or another EVM wallet to connect.')
  const provider = new BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  return { provider, signer: await provider.getSigner() }
}

export async function useRootstockTestnet() {
  if (!window.ethereum) throw new Error('Install MetaMask or another EVM wallet first.')
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ROOTSTOCK_TESTNET.chainId }] })
  } catch (error) {
    if (error.code !== 4902) throw error
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ROOTSTOCK_TESTNET] })
  }
}

export async function marketplace(signerOrProvider) {
  const provider = signerOrProvider.provider || signerOrProvider
  const { chainId } = await provider.getNetwork()
  if (chainId !== 31n) throw new Error('Switch to Rootstock Testnet to use the deployed marketplace contract.')
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider)
}

export { formatEther, parseEther }
