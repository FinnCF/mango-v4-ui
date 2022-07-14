import create from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import produce from 'immer'
import { AnchorProvider, Wallet, web3 } from '@project-serum/anchor'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  MangoClient,
  Group,
  MangoAccount,
  Serum3Market,
  MANGO_V4_ID,
} from '@blockworks-foundation/mango-v4'
import EmptyWallet from '../utils/wallet'
import { Order } from '@project-serum/serum/lib/market'
import { Notification } from '../utils/notifications'
import {
  getTokenAccountsByOwnerWithWrappedSol,
  TokenAccount,
} from '../utils/tokens'
import { Token } from '../types/jupiter'

const DEVNET_GROUP = new PublicKey(
  'A9XhGqUUjV992cD36qWDY8wDiZnGuCaUWtSE3NGXjDCb'
)

export const connection = new web3.Connection(
  'https://mango.rpcpool.com/946ef7337da3f5b8d3e4a34e7f88',
  'processed'
)
const options = AnchorProvider.defaultOptions()
export const CLUSTER = 'mainnet-beta'
export const CLIENT_TX_TIMEOUT = 90000
const DEFAULT_PROVIDER = new AnchorProvider(
  connection,
  new EmptyWallet(Keypair.generate()),
  options
)
DEFAULT_PROVIDER.opts.skipPreflight = true
const DEFAULT_CLIENT = MangoClient.connect(
  DEFAULT_PROVIDER,
  CLUSTER,
  MANGO_V4_ID[CLUSTER]
)

export type MangoStore = {
  connected: boolean
  connection: Connection
  group: Group | undefined
  client: MangoClient
  jupiterTokens: Token[]
  mangoAccount: MangoAccount | undefined
  markets: Serum3Market[] | undefined
  notificationIdCounter: number
  notifications: Array<Notification>
  serumOrders: Order[] | undefined
  inputTokenInfo: any
  outputTokenInfo: any
  set: (x: (x: MangoStore) => void) => void
  wallet: {
    tokens: TokenAccount[]
  }
  actions: {
    fetchGroup: () => Promise<void>
    fetchMangoAccount: (wallet: Wallet) => Promise<void>
    loadSerumMarket: () => Promise<void>
    reloadAccount: () => Promise<void>
    reloadGroup: () => Promise<void>
  }
}

const mangoStore = create<MangoStore>(
  subscribeWithSelector((set, get) => {
    return {
      connected: false,
      connection,
      group: undefined,
      client: DEFAULT_CLIENT,
      inputTokenInfo: undefined,
      jupiterTokens: [],
      mangoAccount: undefined,
      markets: undefined,
      notificationIdCounter: 0,
      notifications: [],
      outputTokenInfo: undefined,
      serumOrders: undefined,
      set: (fn) => set(produce(fn)),
      wallet: {
        tokens: [],
      },
      actions: {
        fetchGroup: async () => {
          try {
            const set = get().set
            const client = get().client
            const group = await client.getGroup(DEVNET_GROUP)
            const markets = await client.serum3GetMarkets(
              group,
              group.banksMap.get('BTC')?.tokenIndex,
              group.banksMap.get('USDC')?.tokenIndex
            )

            set((state) => {
              state.group = group
              state.markets = markets
            })
          } catch (e) {
            console.error('Error fetching group', e)
          }
        },
        fetchMangoAccount: async (wallet) => {
          try {
            const set = get().set
            const group = get().group
            if (!group) throw new Error('Group not loaded')

            const provider = new AnchorProvider(connection, wallet, options)
            provider.opts.skipPreflight = true
            const client = await MangoClient.connect(
              provider,
              CLUSTER,
              MANGO_V4_ID[CLUSTER]
            )

            const mangoAccount = await client.getOrCreateMangoAccount(
              group,
              wallet.publicKey,
              0,
              'Account'
            )

            // let orders = await client.getSerum3Orders(
            //   group,
            //   SERUM3_PROGRAM_ID['devnet'],
            //   'BTC/USDC'
            // )

            await mangoAccount.reloadAccountData(client, group)
            set((state) => {
              state.client = client
              state.mangoAccount = mangoAccount
              state.connected = true
              // state.serumOrders = orders
            })
            console.log('mango', mangoAccount)
          } catch (e) {
            console.error('Error fetching mango acct', e)
          }
        },
        fetchWalletTokens: async (wallet: Wallet) => {
          const set = get().set
          const connection = get().connection

          if (wallet.publicKey) {
            const token = await getTokenAccountsByOwnerWithWrappedSol(
              connection,
              wallet.publicKey
            )

            set((state) => {
              state.wallet.tokens = token
            })
          } else {
            set((state) => {
              state.wallet.tokens = []
            })
          }
        },
        reloadGroup: async () => {
          try {
            const set = get().set
            const client = get().client
            const group = await client.getGroup(DEVNET_GROUP)

            set((state) => {
              state.group = group
            })
          } catch (e) {
            console.error('Error fetching group', e)
          }
        },
        reloadAccount: async () => {
          const set = get().set
          const client = get().client
          const mangoAccount = get().mangoAccount
          const group = get().group

          if (!mangoAccount || !group) return

          try {
            const newMangoAccount = await client.getMangoAccount(mangoAccount)
            await newMangoAccount.reloadAccountData(client, group)

            set((state) => {
              state.mangoAccount = newMangoAccount
            })
          } catch {
            console.error('Error reloading mango account')
          }
        },
        loadSerumMarket: async () => {
          const set = get().set
          const client = get().client
          const group = get().group
          if (!group) return

          const markets = await client.serum3GetMarkets(
            group,
            group.banksMap.get('BTC')?.tokenIndex,
            group.banksMap.get('USDC')?.tokenIndex
          )

          let orders = await client.getSerum3Orders(group, 'BTC/USDC')

          set((state) => {
            state.markets = markets
            state.serumOrders = orders
          })
        },
      },
    }
  })
)

export default mangoStore
