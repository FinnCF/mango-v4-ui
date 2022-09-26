import type { NextPage } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/router'
import ButtonGroup from '../components/forms/ButtonGroup'
import useLocalStorageState from '../hooks/useLocalStorageState'
import dayjs from 'dayjs'
import { ORDERBOOK_FLASH_KEY } from 'utils/constants'
import Switch from '@components/forms/Switch'

require('dayjs/locale/en')
require('dayjs/locale/es')
require('dayjs/locale/zh')
require('dayjs/locale/zh-tw')

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, [
        'common',
        'profile',
        'settings',
      ])),
    },
  }
}

export const LANGS = [
  { locale: 'en', name: 'english', description: 'english' },
  { locale: 'es', name: 'spanish', description: 'spanish' },
  {
    locale: 'zh_tw',
    name: 'chinese-traditional',
    description: 'traditional chinese',
  },
  { locale: 'zh', name: 'chinese', description: 'simplified chinese' },
]

const Settings: NextPage = () => {
  const { t } = useTranslation('common')
  const { theme, setTheme } = useTheme()
  const [savedLanguage, setSavedLanguage] = useLocalStorageState('language', '')
  const router = useRouter()
  const { pathname, asPath, query } = router
  const [showOrderbookFlash, setShowOrderbookFlash] = useLocalStorageState(
    ORDERBOOK_FLASH_KEY,
    true
  )
  const THEMES = [t('settings:light'), t('settings:dark'), t('settings:mango')]

  const handleLangChange = (l: string) => {
    setSavedLanguage(l)
    router.push({ pathname, query }, asPath, { locale: l })
    dayjs.locale(l == 'zh_tw' ? 'zh-tw' : l)
  }

  return (
    <div className="p-8 pb-20 md:pb-16 lg:p-10">
      <div className="grid grid-cols-12">
        <div className="col-span-12 border-b border-th-bkg-3 lg:col-span-8 lg:col-start-3">
          <h2 className="mb-4 text-base">{t('settings:display')}</h2>
          <div className="flex flex-col border-t border-th-bkg-3 p-4 md:flex-row md:items-center md:justify-between">
            <p className="mb-2 lg:mb-0">{t('settings:theme')}</p>
            <div className="w-full min-w-[220px] md:w-auto">
              <ButtonGroup
                activeValue={theme}
                onChange={(t) => setTheme(t)}
                values={THEMES}
                large
              />
            </div>
          </div>
          <div className="flex flex-col border-t border-th-bkg-3 p-4 md:flex-row md:items-center md:justify-between">
            <p className="mb-2 lg:mb-0">{t('settings:language')}</p>
            <div className="w-full min-w-[330px] md:w-auto">
              <ButtonGroup
                activeValue={savedLanguage}
                onChange={(l) => handleLangChange(l)}
                values={LANGS.map((val) => val.locale)}
                names={LANGS.map((val) => t(`settings:${val.name}`))}
                large
              />
            </div>
          </div>
          <div className="flex flex-col border-t border-th-bkg-3 p-4 md:flex-row md:items-center md:justify-between">
            <p className="mb-2 lg:mb-0">{t('settings:orderbook-flash')}</p>
            <Switch
              checked={showOrderbookFlash}
              onChange={(checked) => setShowOrderbookFlash(checked)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
