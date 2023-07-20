import WalletIcon from '@components/icons/WalletIcon'
import { LinkIcon } from '@heroicons/react/20/solid'
import { useTranslation } from 'next-i18next'
import Button from './Button'
import { useWallet } from '@solana/wallet-adapter-react'

const ConnectEmptyState = ({ text }: { text: string }) => {
  const { t } = useTranslation('common')
  const { connect } = useWallet()
  return (
    <div className="flex flex-col items-center">
      <WalletIcon className="mb-2 h-6 w-6 text-th-fgd-4" />
      <p className="mb-4">{text}</p>
      <Button onClick={connect}>
        <div className="flex items-center">
          <LinkIcon className="mr-2 h-5 w-5" />
          {t('connect')}
        </div>
      </Button>
    </div>
  )
}

export default ConnectEmptyState
