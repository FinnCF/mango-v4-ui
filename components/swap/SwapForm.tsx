import { useState, useCallback, useMemo, useEffect } from 'react'
import { PublicKey } from '@solana/web3.js'
import { PencilIcon } from '@heroicons/react/20/solid'
import mangoStore from '@store/mangoStore'
import ContentBox from '../shared/ContentBox'
import { useTranslation } from 'next-i18next'
import SwapFormTokenList from './SwapFormTokenList'
import { LinkButton } from '../shared/Button'
import { EnterBottomExitBottom } from '../shared/Transitions'
import { HealthType } from '@blockworks-foundation/mango-v4'
import { OUTPUT_TOKEN_DEFAULT, SWAP_MARGIN_KEY } from '../../utils/constants'
import HealthImpact from '@components/shared/HealthImpact'
import TokenVaultWarnings from '@components/shared/TokenVaultWarnings'
import SwapSettings from './SwapSettings'
import InlineNotification from '@components/shared/InlineNotification'
import Tooltip from '@components/shared/Tooltip'
import MarketSwapForm from './MarketSwapForm'
import Switch from '@components/forms/Switch'
import useLocalStorageState from 'hooks/useLocalStorageState'
import { SwapFormTokenListType } from './SwapFormTokenList'
import { TriggerOrderTypes } from 'types'
import TriggerSwapForm from './TriggerSwapForm'
import WalletSwapForm from './WalletSwapForm'
import TabButtons from '@components/shared/TabButtons'
import useMangoAccount from 'hooks/useMangoAccount'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/router'

const set = mangoStore.getState().set

const SwapForm = () => {
  const { t } = useTranslation(['common', 'swap', 'trade'])
  const groupLoaded = mangoStore((s) => s.groupLoaded)
  const { mangoAccountAddress, initialLoad } = useMangoAccount()
  const { connected } = useWallet()
  const { query } = useRouter()
  const [showTokenSelect, setShowTokenSelect] =
    useState<SwapFormTokenListType>()
  const [showSettings, setShowSettings] = useState(false)
  const [walletSwap, setWalletSwap] = useState(false)
  const [, setSavedSwapMargin] = useLocalStorageState<boolean>(
    SWAP_MARGIN_KEY,
    true,
  )

  const {
    margin: useMargin,
    slippage,
    inputBank,
    outputBank,
    amountIn: amountInFormValue,
    amountOut: amountOutFormValue,
    swapOrTrigger,
  } = mangoStore((s) => s.swap)

  // enable wallet swap when connected and no mango account
  useEffect(() => {
    if (connected && !mangoAccountAddress && !initialLoad) {
      setWalletSwap(true)
    }
  }, [connected, mangoAccountAddress, initialLoad])

  // setup swap from url query
  useEffect(() => {
    const { group } = mangoStore.getState()
    if ('walletSwap' in query) {
      setWalletSwap(true)
    }
    if (!groupLoaded) return
    if (query.in) {
      const inBank = group?.banksMapByName.get(query.in.toString())?.[0]
      set((state) => {
        state.swap.inputBank = inBank
      })
    }
    if (query.out) {
      const outBank = group?.banksMapByName.get(query.out.toString())?.[0]
      set((state) => {
        state.swap.outputBank = outBank
      })
    }
  }, [groupLoaded, query])

  const handleTokenInSelect = useCallback((mintAddress: string) => {
    const group = mangoStore.getState().group
    if (group) {
      const bank = group.getFirstBankByMint(new PublicKey(mintAddress))
      set((s) => {
        s.swap.inputBank = bank
      })
    }
    setShowTokenSelect(undefined)
  }, [])

  const handleTokenOutSelect = useCallback((mintAddress: string) => {
    const group = mangoStore.getState().group
    if (group) {
      const bank = group.getFirstBankByMint(new PublicKey(mintAddress))
      set((s) => {
        s.swap.outputBank = bank
      })
    }
    setShowTokenSelect(undefined)
  }, [])

  const maintProjectedHealth = useMemo(() => {
    const group = mangoStore.getState().group
    const mangoAccount = mangoStore.getState().mangoAccount.current
    if (
      !inputBank ||
      !mangoAccount ||
      !outputBank ||
      !amountInFormValue ||
      !amountOutFormValue ||
      !group
    )
      return 100

    const simulatedHealthRatio =
      mangoAccount.simHealthRatioWithTokenPositionUiChanges(
        group,
        [
          {
            mintPk: inputBank.mint,
            uiTokenAmount: parseFloat(amountInFormValue) * -1,
          },
          {
            mintPk: outputBank.mint,
            uiTokenAmount: parseFloat(amountOutFormValue),
          },
        ],
        HealthType.maint,
      )
    return simulatedHealthRatio > 100
      ? 100
      : simulatedHealthRatio < 0
      ? 0
      : Math.trunc(simulatedHealthRatio)
  }, [inputBank, outputBank, amountInFormValue, amountOutFormValue])

  const handleSwapOrTrigger = useCallback(
    (orderType: TriggerOrderTypes) => {
      set((state) => {
        state.swap.swapOrTrigger = orderType
        if (orderType !== 'swap' && outputBank?.name === OUTPUT_TOKEN_DEFAULT) {
          const { group } = mangoStore.getState()
          const outputBankName = inputBank?.name === 'USDC' ? 'SOL' : 'USDC'
          state.swap.outputBank = group?.banksMapByName.get(outputBankName)?.[0]
        }
      })
    },
    [inputBank, outputBank],
  )

  const handleSetMargin = () => {
    set((s) => {
      s.swap.margin = !s.swap.margin
    })
  }

  useEffect(() => {
    setSavedSwapMargin(useMargin)
  }, [useMargin])

  const estSlippage = useMemo(() => {
    const { group } = mangoStore.getState()
    const amountIn = parseFloat(amountInFormValue) || 0
    if (!group || !inputBank || amountIn <= 0) return 0
    const value = amountIn * inputBank.uiPrice
    const slippage = group.getPriceImpactByTokenIndex(
      inputBank.tokenIndex,
      value,
    )
    return slippage
  }, [amountInFormValue, inputBank])

  return (
    <ContentBox
      hidePadding
      className="relative overflow-hidden border-x-0 bg-th-bkg-1 md:border-b-0 md:border-l md:border-r-0 md:border-t-0"
    >
      <div>
        <EnterBottomExitBottom
          className="thin-scroll absolute bottom-0 left-0 z-10 h-full w-full overflow-auto bg-th-bkg-1 p-6 pb-0"
          show={!!showTokenSelect}
        >
          <SwapFormTokenList
            onClose={() => setShowTokenSelect(undefined)}
            onTokenSelect={
              showTokenSelect === 'input' ||
              showTokenSelect === 'reduce-input' ||
              showTokenSelect === 'wallet-input'
                ? handleTokenInSelect
                : handleTokenOutSelect
            }
            type={showTokenSelect}
            useMargin={swapOrTrigger === 'swap' ? useMargin : false}
          />
        </EnterBottomExitBottom>
        <EnterBottomExitBottom
          className="thin-scroll absolute bottom-0 left-0 z-10 h-full w-full overflow-auto bg-th-bkg-1 p-6 pb-0"
          show={showSettings}
        >
          <SwapSettings onClose={() => setShowSettings(false)} />
        </EnterBottomExitBottom>
        <div className="relative border-b border-th-bkg-3">
          <TabButtons
            activeValue={swapOrTrigger}
            fillWidth
            values={[
              ['swap', 0],
              ['trade:trigger-order', 0],
            ]}
            onChange={(v) => handleSwapOrTrigger(v)}
          />
        </div>
        <div className="relative">
          {swapOrTrigger === 'swap' ? (
            <>
              <div className="flex justify-end pb-3 pt-4">
                <div className="flex justify-between px-6">
                  <Switch
                    checked={walletSwap}
                    onChange={() => setWalletSwap(!walletSwap)}
                    small
                  >
                    <Tooltip content={t('swap:tooltip-wallet-swap')}>
                      <span className="tooltip-underline">
                        {t('swap:wallet-swap')}
                      </span>
                    </Tooltip>
                  </Switch>
                </div>
              </div>
              {walletSwap ? (
                <div className="px-6">
                  <WalletSwapForm setShowTokenSelect={setShowTokenSelect} />
                </div>
              ) : (
                <div className="px-6">
                  <MarketSwapForm setShowTokenSelect={setShowTokenSelect} />
                </div>
              )}
            </>
          ) : (
            <div className="px-6 pt-4">
              <TriggerSwapForm
                showTokenSelect={showTokenSelect}
                setShowTokenSelect={setShowTokenSelect}
              />
            </div>
          )}
          <div className="px-6 pb-6">
            {inputBank && !walletSwap ? (
              <TokenVaultWarnings bank={inputBank} type="swap" />
            ) : null}
            {inputBank &&
            !walletSwap &&
            inputBank.areBorrowsReduceOnly() &&
            inputBank.areDepositsReduceOnly() ? (
              <div className="pb-4">
                <InlineNotification
                  type="warning"
                  desc={t('swap:input-reduce-only-warning', {
                    symbol: inputBank.name,
                  })}
                />
              </div>
            ) : null}
            {outputBank &&
            !walletSwap &&
            outputBank.areBorrowsReduceOnly() &&
            outputBank.areDepositsReduceOnly() ? (
              <div className="pb-4">
                <InlineNotification
                  type="warning"
                  desc={t('swap:output-reduce-only-warning', {
                    symbol: outputBank.name,
                  })}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              {!walletSwap ? (
                <HealthImpact maintProjectedHealth={maintProjectedHealth} />
              ) : null}
              {swapOrTrigger === 'swap' ? (
                <>
                  {!walletSwap ? (
                    <div className="flex items-center justify-between">
                      <Tooltip content={t('swap:tooltip-margin')}>
                        <p className="tooltip-underline text-sm text-th-fgd-3">
                          {t('swap:margin')}
                        </p>
                      </Tooltip>
                      <Switch
                        className="text-th-fgd-3"
                        checked={useMargin}
                        onChange={handleSetMargin}
                        small
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-th-fgd-3">
                      {t('swap:max-slippage')}
                    </p>
                    <LinkButton
                      className="flex items-center text-right font-mono text-sm font-normal text-th-fgd-2"
                      onClick={() => setShowSettings(true)}
                    >
                      <span className="mr-1.5">{slippage}%</span>
                      <PencilIcon className="h-4 w-4" />
                    </LinkButton>
                  </div>
                </>
              ) : null}
              {estSlippage ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-th-fgd-3">
                      {t('trade:est-slippage')}
                    </p>
                    <span className="font-mono text-th-fgd-2">
                      {estSlippage.toFixed(2)}%
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ContentBox>
  )
}

export default SwapForm
