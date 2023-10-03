import HideMangoAccount from '@components/account/HideMangoAccount'
import MangoAccountSizeModal from '@components/modals/MangoAccountSizeModal'
import Button, { LinkButton } from '@components/shared/Button'
import TokenLogo from '@components/shared/TokenLogo'
import Tooltip from '@components/shared/Tooltip'
import MarketLogos from '@components/trade/MarketLogos'
import { Disclosure } from '@headlessui/react'
import { ChevronDownIcon, SquaresPlusIcon } from '@heroicons/react/20/solid'
import useMangoAccount from 'hooks/useMangoAccount'
import useMangoAccountAccounts from 'hooks/useMangoAccountAccounts'
import useMangoGroup from 'hooks/useMangoGroup'
import { useTranslation } from 'next-i18next'
import { useCallback, useMemo, useState } from 'react'
import { MAX_ACCOUNTS } from 'utils/constants'
import mangoStore from '@store/mangoStore'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { notify } from 'utils/notifications'
import { isMangoError } from 'types'
import { getMaxWithdrawForBank } from '@components/swap/useTokenMax'
import Decimal from 'decimal.js'
import { formatTokenSymbol } from 'utils/tokens'
import { handleCancelAll } from '@components/swap/SwapTriggerOrders'

enum CLOSE_TYPE {
  TOKEN,
  PERP,
  SERUMOO,
  PERPOO,
}

const CLOSE_WRAPPER_CLASSNAMES =
  'mb-4 flex flex-col md:flex-row md:items-center md:justify-between rounded-md bg-th-bkg-2 px-4 py-3'

const SLOT_ROW_CLASSNAMES =
  'flex items-center justify-between border-t border-th-bkg-3 py-3'

const AccountSettings = () => {
  const { t } = useTranslation(['common', 'settings', 'trade'])
  const { mangoAccountAddress } = useMangoAccount()
  const { group } = useMangoGroup()
  const [showAccountSizeModal, setShowAccountSizeModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelTcs, setCancelTcs] = useState('')
  const {
    usedTokens,
    usedSerum3,
    usedPerps,
    usedPerpOo,
    usedTcs,
    emptySerum3,
    emptyPerps,
    totalTokens,
    totalSerum3,
    totalPerps,
    totalPerpOpenOrders,
    isAccountFull,
  } = useMangoAccountAccounts()

  const tokenStatus = useMemo(() => {
    const mangoAccount = mangoStore.getState().mangoAccount.current
    if (!group || !mangoAccount || !usedTokens.length) return []
    const tokens = []
    for (const token of usedTokens) {
      const bank = group.getFirstBankByTokenIndex(token.tokenIndex)
      const tokenMax = getMaxWithdrawForBank(group, bank, mangoAccount)
      const balance = mangoAccount.getTokenBalanceUi(bank)
      const isClosable = tokenMax.eq(new Decimal(balance)) && !token.inUseCount
      tokens.push({ isClosable, balance, tokenIndex: token.tokenIndex })
    }
    return tokens
  }, [group, mangoAccountAddress, usedTokens])

  const handleCloseToken = useCallback(
    async (tokenMint: PublicKey) => {
      const client = mangoStore.getState().client
      const group = mangoStore.getState().group
      const mangoAccount = mangoStore.getState().mangoAccount.current
      const actions = mangoStore.getState().actions
      if (!mangoAccount || !group) return

      setSubmitting(true)

      try {
        const { signature: tx, slot } =
          await client.tokenWithdrawAllDepositForMint(
            group,
            mangoAccount,
            tokenMint,
          )
        notify({
          title: 'Transaction confirmed',
          type: 'success',
          txid: tx,
        })
        await actions.reloadMangoAccount(slot)
        setSubmitting(false)
      } catch (e) {
        console.error(e)
        setSubmitting(false)
        if (!isMangoError(e)) return
        notify({
          title: 'Transaction failed',
          description: e.message,
          txid: e?.txid,
          type: 'error',
        })
      }
    },
    [setSubmitting],
  )

  const handleCloseSlots = useCallback(
    async (closeType: CLOSE_TYPE) => {
      const client = mangoStore.getState().client
      const group = mangoStore.getState().group
      const mangoAccount = mangoStore.getState().mangoAccount.current
      const actions = mangoStore.getState().actions
      if (!mangoAccount || !group) return
      setSubmitting(true)
      try {
        let ixs: TransactionInstruction[] = []
        if (closeType === CLOSE_TYPE.PERP) {
          try {
            ixs = await Promise.all(
              emptyPerps.map((p) =>
                client.perpDeactivatePositionIx(
                  group,
                  mangoAccount,
                  p.marketIndex,
                ),
              ),
            )
          } catch (e) {
            console.log('error closing unused perp positions', e)
          }
        } else if (closeType === CLOSE_TYPE.SERUMOO) {
          try {
            ixs = await Promise.all(
              emptySerum3.map((s) => {
                const market = group.getSerum3MarketByMarketIndex(s.marketIndex)
                return client.serum3CloseOpenOrdersIx(
                  group,
                  mangoAccount,
                  market.serumMarketExternal,
                )
              }),
            )
          } catch (e) {
            console.log('error closing unused serum open orders', e)
          }
        } else if (closeType === CLOSE_TYPE.PERPOO) {
          // No instruction yet
        }

        if (ixs.length === 0) return
        const tx = await client.sendAndConfirmTransaction(ixs)

        notify({
          title: 'Transaction confirmed',
          type: 'success',
          txid: tx.signature,
        })
        await actions.reloadMangoAccount()
        setSubmitting(false)
      } catch (e) {
        console.error(e)
        setSubmitting(false)
        if (!isMangoError(e)) return
        notify({
          title: 'Transaction failed',
          description: e.message,
          txid: e?.txid,
          type: 'error',
        })
      }
    },
    [emptyPerps, emptySerum3],
  )

  return mangoAccountAddress && group ? (
    <div className="border-b border-th-bkg-3">
      <div className="pb-6">
        <HideMangoAccount />
      </div>
      <div className="mb-4 flex items-center justify-between md:px-4">
        <h3 className="text-sm text-th-fgd-2">{t('settings:account-slots')}</h3>
        {!isAccountFull ? (
          <LinkButton
            className="flex items-center"
            onClick={() => setShowAccountSizeModal(true)}
          >
            <SquaresPlusIcon className="mr-1.5 h-4 w-4" />
            {t('settings:increase-account-slots')}
          </LinkButton>
        ) : null}
      </div>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full border-t border-th-bkg-3 py-4 md:px-4">
              <div className="flex items-center justify-between">
                <Tooltip
                  content={t('settings:tooltip-token-accounts', {
                    max: MAX_ACCOUNTS.tokenAccounts,
                  })}
                >
                  <p className="tooltip-underline">{t('tokens')}</p>
                </Tooltip>
                <ChevronDownIcon
                  className={`${
                    open ? 'rotate-180' : 'rotate-360'
                  } h-6 w-6 flex-shrink-0 text-th-fgd-3`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="pb-2 md:px-4">
              <div className={CLOSE_WRAPPER_CLASSNAMES}>
                <div>
                  <p className="font-bold text-th-fgd-2">
                    {t('settings:slots-used', {
                      used: usedTokens.length,
                      total: totalTokens.length,
                      type: t('tokens').toLowerCase(),
                    })}
                  </p>
                  <p className="mt-1">
                    {t('settings:close-token-positions-desc')}
                  </p>
                </div>
              </div>
              {usedTokens.length ? (
                usedTokens.map((token, i) => {
                  const tokenBank = group.getFirstBankByTokenIndex(
                    token.tokenIndex,
                  )
                  const status = tokenStatus.find(
                    (t) => t.tokenIndex === token.tokenIndex,
                  )

                  const isCollateral =
                    tokenBank
                      .scaledInitAssetWeight(tokenBank.price)
                      .toNumber() > 0
                  return (
                    <div className={SLOT_ROW_CLASSNAMES} key={token.tokenIndex}>
                      <div className="flex items-center">
                        <p className="mr-3 text-th-fgd-4">{i + 1}.</p>
                        <TokenLogo bank={tokenBank} size={20} />
                        <div className="ml-2">
                          <p className="text-th-fgd-2">{tokenBank.name}</p>
                          <p className="font-mono text-xs text-th-fgd-4">
                            {status?.balance}
                          </p>
                        </div>
                      </div>
                      {status?.isClosable ? (
                        <Button
                          disabled={submitting}
                          onClick={() => handleCloseToken(tokenBank.mint)}
                          secondary
                          size="small"
                        >
                          {t('close')}
                        </Button>
                      ) : (
                        <Tooltip
                          content={
                            tokenBank.name === 'USDC'
                              ? t('settings:tooltip-close-usdc-instructions')
                              : isCollateral
                              ? t(
                                  'settings:tooltip-close-collateral-token-instructions',
                                  {
                                    token: tokenBank.name,
                                  },
                                )
                              : t('settings:tooltip-close-token-instructions', {
                                  token: tokenBank.name,
                                })
                          }
                        >
                          <p className="tooltip-underline">
                            {t('settings:close-instructions')}
                          </p>
                        </Tooltip>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="mb-2 text-center">
                  {t('notifications:empty-state-title')}...
                </p>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full border-t border-th-bkg-3 py-4 md:px-4">
              <div className="flex items-center justify-between">
                <Tooltip
                  content={t('settings:tooltip-spot-markets', {
                    max: MAX_ACCOUNTS.spotOpenOrders,
                  })}
                >
                  <p className="tooltip-underline">
                    {t('settings:spot-markets')}
                  </p>
                </Tooltip>
                <ChevronDownIcon
                  className={`${
                    open ? 'rotate-180' : 'rotate-360'
                  } h-6 w-6 flex-shrink-0 text-th-fgd-3`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="pb-2 md:px-4">
              <div className={CLOSE_WRAPPER_CLASSNAMES}>
                <div>
                  <p className="font-bold text-th-fgd-2">
                    {t('settings:slots-used', {
                      used: usedSerum3.length,
                      total: totalSerum3.length,
                      type: t('settings:spot-markets').toLowerCase(),
                    })}
                  </p>
                  <p className="mt-1">{t('settings:close-spot-oo-desc')}</p>
                </div>
                <Button
                  className="mt-4 whitespace-nowrap md:ml-4 md:mt-0"
                  disabled={!emptySerum3.length || submitting}
                  onClick={() => handleCloseSlots(CLOSE_TYPE.SERUMOO)}
                  secondary
                  size="small"
                >
                  {t('settings:close-unused')}
                </Button>
              </div>
              {usedSerum3.length ? (
                usedSerum3.map((mkt, i) => {
                  const market = group.getSerum3MarketByMarketIndex(
                    mkt.marketIndex,
                  )
                  const isUnused = !!emptySerum3.find(
                    (m) => m.marketIndex === mkt.marketIndex,
                  )
                  return (
                    <div className={SLOT_ROW_CLASSNAMES} key={mkt.marketIndex}>
                      <div className="flex items-center">
                        <p className="mr-3 text-th-fgd-4">{i + 1}.</p>
                        <MarketLogos market={market} />
                        <p className="text-th-fgd-2">{market.name}</p>
                      </div>
                      <IsUnusedBadge isUnused={isUnused} />
                    </div>
                  )
                })
              ) : (
                <p className="mb-2 text-center">
                  {t('notifications:empty-state-title')}...
                </p>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full border-t border-th-bkg-3 py-4 md:px-4">
              <div className="flex items-center justify-between">
                <Tooltip
                  content={t('settings:tooltip-perp-markets', {
                    max: MAX_ACCOUNTS.perpAccounts,
                  })}
                >
                  <p className="tooltip-underline">
                    {t('settings:perp-markets')}
                  </p>
                </Tooltip>
                <ChevronDownIcon
                  className={`${
                    open ? 'rotate-180' : 'rotate-360'
                  } h-6 w-6 flex-shrink-0 text-th-fgd-3`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="pb-2 md:px-4">
              <div className={CLOSE_WRAPPER_CLASSNAMES}>
                <div>
                  <p className="font-bold text-th-fgd-2">
                    {t('settings:slots-used', {
                      used: usedPerps.length,
                      total: totalPerps.length,
                      type: t('settings:perp-positions').toLowerCase(),
                    })}
                  </p>
                  <p className="mt-1">{t('settings:close-perp-desc')}</p>
                </div>
                <Button
                  className="mt-4 whitespace-nowrap md:ml-4 md:mt-0"
                  disabled={!emptyPerps.length || submitting}
                  onClick={() => handleCloseSlots(CLOSE_TYPE.PERP)}
                  secondary
                  size="small"
                >
                  {t('settings:close-unused')}
                </Button>
              </div>
              {usedPerps.length ? (
                usedPerps.map((perp, i) => {
                  const market = group.getPerpMarketByMarketIndex(
                    perp.marketIndex,
                  )
                  const isUnused = !!emptyPerps.find(
                    (mkt) => mkt.marketIndex === perp.marketIndex,
                  )
                  return (
                    <div className={SLOT_ROW_CLASSNAMES} key={perp.marketIndex}>
                      <div className="flex items-center">
                        <p className="mr-3 text-th-fgd-4">{i + 1}.</p>
                        <MarketLogos market={market} />
                        <p className="text-th-fgd-2">{market.name}</p>
                      </div>
                      <IsUnusedBadge isUnused={isUnused} />
                    </div>
                  )
                })
              ) : (
                <p className="mb-2 text-center">
                  {t('notifications:empty-state-title')}...
                </p>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full border-t border-th-bkg-3 py-4 md:px-4">
              <div className="flex items-center justify-between">
                <Tooltip
                  content={t('settings:tooltip-perp-open-orders', {
                    max: MAX_ACCOUNTS.perpOpenOrders,
                  })}
                >
                  <p className="tooltip-underline">
                    {t('settings:perp-open-orders')}
                  </p>
                </Tooltip>
                <ChevronDownIcon
                  className={`${
                    open ? 'rotate-180' : 'rotate-360'
                  } h-6 w-6 flex-shrink-0 text-th-fgd-3`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="pb-2 md:px-4">
              <div className={CLOSE_WRAPPER_CLASSNAMES}>
                <p className="font-bold text-th-fgd-2">
                  {t('settings:slots-used', {
                    used: usedPerpOo.length,
                    total: totalPerpOpenOrders.length,
                    type: t('settings:perp-open-orders').toLowerCase(),
                  })}
                </p>
              </div>
              {usedPerpOo.length ? (
                usedPerpOo.map((perp, i) => {
                  const market = group.getPerpMarketByMarketIndex(
                    perp.orderMarket,
                  )
                  return (
                    <div
                      className="mb-2 flex items-center"
                      key={perp.orderMarket}
                    >
                      <p className="mr-3 text-th-fgd-4">{i + 1}.</p>
                      <MarketLogos market={market} />
                      <p className="text-th-fgd-2">{market.name}</p>
                    </div>
                  )
                })
              ) : (
                <p className="mb-2 text-center">
                  {t('notifications:empty-state-title')}...
                </p>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      <Disclosure>
        {({ open }) => (
          <>
            <Disclosure.Button className="w-full border-t border-th-bkg-3 py-4 md:px-4">
              <div className="flex items-center justify-between">
                <p>{t('trade:trigger-orders')}</p>
                <ChevronDownIcon
                  className={`${
                    open ? 'rotate-180' : 'rotate-360'
                  } h-6 w-6 flex-shrink-0 text-th-fgd-3`}
                />
              </div>
            </Disclosure.Button>
            <Disclosure.Panel className="pb-2 md:px-4">
              <div className={CLOSE_WRAPPER_CLASSNAMES}>
                <p className="font-bold text-th-fgd-2">
                  {t('settings:trigger-orders-used', {
                    orders: usedTcs.length,
                  })}
                </p>
                <Button
                  className="mt-4 whitespace-nowrap md:ml-4 md:mt-0"
                  disabled={!usedTcs.length || !!cancelTcs}
                  onClick={() => handleCancelAll(setCancelTcs)}
                  secondary
                  size="small"
                >
                  {t('trade:cancel-all')}
                </Button>
              </div>
              {usedTcs.length ? (
                usedTcs.map((tcs, i) => {
                  const buyBank = group.getFirstBankByTokenIndex(
                    tcs.buyTokenIndex,
                  )
                  const sellBank = group.getFirstBankByTokenIndex(
                    tcs.sellTokenIndex,
                  )
                  const maxBuy = tcs.getMaxBuyUi(group)
                  const maxSell = tcs.getMaxSellUi(group)
                  let side
                  if (maxBuy === 0 || maxBuy > maxSell) {
                    side = 'sell'
                  } else {
                    side = 'buy'
                  }
                  const formattedBuyTokenName = formatTokenSymbol(buyBank.name)
                  const formattedSellTokenName = formatTokenSymbol(
                    sellBank.name,
                  )
                  const pair =
                    side === 'sell'
                      ? `${formattedSellTokenName}/${formattedBuyTokenName}`
                      : `${formattedBuyTokenName}/${formattedSellTokenName}`
                  return (
                    <div
                      className="mb-2 flex items-center"
                      key={tcs.id.toString()}
                    >
                      <p className="mr-3 text-th-fgd-4">{i + 1}.</p>
                      <p className="text-th-fgd-2">{pair}</p>
                    </div>
                  )
                })
              ) : (
                <p className="mb-2 text-center">
                  {t('notifications:empty-state-title')}...
                </p>
              )}
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      {showAccountSizeModal ? (
        <MangoAccountSizeModal
          isOpen={showAccountSizeModal}
          onClose={() => setShowAccountSizeModal(false)}
        />
      ) : null}
    </div>
  ) : null
}

export default AccountSettings

const IsUnusedBadge = ({ isUnused }: { isUnused: boolean }) => {
  const { t } = useTranslation('settings')
  return (
    <div className="rounded bg-th-bkg-2 px-1 py-0.5 text-xs text-th-fgd-3">
      <span className="uppercase">
        {isUnused ? (
          t('settings:unused')
        ) : (
          <span className="text-th-success">{t('settings:in-use')}</span>
        )}
      </span>
    </div>
  )
}
