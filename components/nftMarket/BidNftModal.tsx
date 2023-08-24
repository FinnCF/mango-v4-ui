import { ModalProps } from '../../types/modal'
import Modal from '../shared/Modal'
import { useState, useCallback } from 'react'
import Input from '@components/forms/Input'
import Label from '@components/forms/Label'
import Button, { LinkButton } from '@components/shared/Button'
import { MANGO_MINT_DECIMALS } from 'utils/governance/constants'
import { Listing, PublicKey, token } from '@metaplex-foundation/js'
import metaplexStore from '@store/metaplexStore'
import { useAuctionHouse, useBids } from 'hooks/market/useAuctionHouse'
import { ImgWithLoader } from '@components/ImgWithLoader'
// import { useTranslation } from 'next-i18next'
import { toUiDecimals } from '@blockworks-foundation/mango-v4'
import Loading from '@components/shared/Loading'
import { notify } from 'utils/notifications'

type ListingModalProps = {
  listing?: Listing
} & ModalProps

const BidNftModal = ({ isOpen, onClose, listing }: ListingModalProps) => {
  const metaplex = metaplexStore((s) => s.metaplex)
  const { data: auctionHouse } = useAuctionHouse()
  const { refetch } = useBids()
  // const { t } = useTranslation(['nft-market'])
  const noneListedAssetMode = !listing

  const [bidPrice, setBidPrice] = useState('')
  const [assetMint, setAssetMint] = useState('')
  const [submittingOffer, setSubmittingOffer] = useState(false)

  const bid = useCallback(async () => {
    setSubmittingOffer(true)
    try {
      const { response } = await metaplex!.auctionHouse().bid({
        auctionHouse: auctionHouse!,
        price: token(bidPrice, MANGO_MINT_DECIMALS),
        mintAccount: noneListedAssetMode
          ? new PublicKey(assetMint)
          : listing!.asset.mint.address,
      })
      onClose()
      refetch()
      if (response) {
        notify({
          title: 'Transaction confirmed',
          type: 'success',
          txid: response.signature,
        })
      }
    } catch (e) {
      console.log('error making offer', e)
    } finally {
      setSubmittingOffer(false)
    }
  }, [
    metaplex,
    auctionHouse,
    bidPrice,
    noneListedAssetMode,
    assetMint,
    listing,
    onClose,
    refetch,
    setSubmittingOffer,
  ])

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="mb-4 text-center text-lg">Make an Offer</h2>
      <div className="flex flex-col items-center">
        {listing ? (
          <ImgWithLoader
            alt={listing.asset.name}
            className="mb-3 h-40 w-40 flex-shrink-0 rounded-md"
            src={listing.asset.json!.image!}
          />
        ) : (
          <>
            <Label text="NFT Mint" />
            <Input
              className="mb-2"
              type="text"
              value={assetMint}
              onChange={(e) => {
                setAssetMint(e.target.value)
              }}
            />
          </>
        )}
        <div className="mt-4 flex w-full items-end">
          <div className="w-full">
            <Label text="Offer Price"></Label>
            <Input
              value={bidPrice}
              onChange={(e) => {
                setBidPrice(e.target.value)
              }}
              suffix="MNGO"
            />
          </div>
          <Button
            className="ml-2 flex items-center justify-center whitespace-nowrap"
            onClick={bid}
            disabled={!bidPrice}
            size="large"
          >
            {submittingOffer ? <Loading /> : 'Make Offer'}
          </Button>
        </div>
        {listing ? (
          <LinkButton className="mt-4">
            <span className="font-body font-normal">
              Buy Now:{' '}
              <span className="font-display">
                {toUiDecimals(
                  listing.price.basisPoints.toNumber(),
                  MANGO_MINT_DECIMALS,
                )}{' '}
                <span className="font-bold">MNGO</span>
              </span>
            </span>
          </LinkButton>
        ) : null}
      </div>
    </Modal>
  )
}

export default BidNftModal
