import './globals.css'

export const metadata = {
  title: '抽卡分析与氪金性价比',
  description: '纯静态的游戏抽卡分析与氪金性价比计算工具'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

