export interface PityConfig {
  baseRate: number
  softPityStart: number | null
  softPityIncreasePerPull: number | null
  hardPity: number
  featuredWinRate: number
  guaranteedAfterLoses: number
}

export interface UserState {
  pityCounter: number
  guaranteedLoses: number
}

// 将概率限制在 [0, 1]，并对 NaN 做安全处理
const clamp01 = (value: number) => {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

// 离散卷积：计算两次独立事件的“总抽数”分布
const convolvePDF = (a: number[], b: number[]) => {
  const resultLength = (a.length - 1) + (b.length - 1) + 1
  const result = new Array(resultLength).fill(0)
  for (let i = 1; i < a.length; i += 1) {
    const aProb = a[i]
    if (aProb === 0) continue
    for (let j = 1; j < b.length; j += 1) {
      const bProb = b[j]
      if (bProb === 0) continue
      result[i + j] += aProb * bProb
    }
  }
  return result
}

// 将一个 PDF 按权重累加到目标数组中（用于组合互斥情况）
const addWeightedPDF = (target: number[], pdf: number[], weight: number) => {
  const w = weight
  if (w === 0) return target
  if (target.length < pdf.length) {
    for (let i = target.length; i < pdf.length; i += 1) {
      target.push(0)
    }
  }
  for (let i = 1; i < pdf.length; i += 1) {
    target[i] += pdf[i] * w
  }
  return target
}

// 获取当前第 currentPullIndex 抽的真实出金概率
export function getPullRate(config: PityConfig, currentPullIndex: number): number {
  const hardPity = Math.max(1, Math.floor(config.hardPity))
  const pullIndex = Math.max(1, Math.floor(currentPullIndex))

  if (pullIndex >= hardPity) return 1

  const baseRate = clamp01(config.baseRate)
  const softStart = config.softPityStart
  const softIncrease = config.softPityIncreasePerPull

  let rate = baseRate
  if (softStart !== null && softIncrease !== null && pullIndex >= softStart) {
    const steps = pullIndex - softStart + 1
    rate = baseRate + softIncrease * steps
  }

  return clamp01(rate)
}

// 计算“刚好在第 i 抽出五星”的概率密度函数（PDF）
export function getSingleFiveStarPDF(config: PityConfig, state: UserState): number[] {
  const hardPity = Math.max(1, Math.floor(config.hardPity))
  const pityCounter = Math.max(0, Math.floor(state.pityCounter))
  const remaining = Math.max(1, hardPity - pityCounter)

  const pdf = new Array(remaining + 1).fill(0)
  // 存活概率：到当前抽之前仍未出金的概率
  let survivalProb = 1

  for (let i = 1; i <= remaining; i += 1) {
    const currentPullIndex = pityCounter + i
    const rate = getPullRate(config, currentPullIndex)
    const hitProb = survivalProb * rate
    pdf[i] = hitProb
    survivalProb *= (1 - rate)
  }

  return pdf
}

// 计算“抽出 1 个 UP 角色”的概率分布（处理大小保底）
export function getSingleUpPDF(
  config: PityConfig,
  fiveStarPDF: number[],
  state: UserState
): number[] {
  const guaranteedAfterLoses = Math.max(0, Math.floor(config.guaranteedAfterLoses))
  const guaranteedAlready = state.guaranteedLoses >= guaranteedAfterLoses

  if (guaranteedAfterLoses === 0 || guaranteedAlready) {
    return fiveStarPDF.slice()
  }

  const winRate = clamp01(config.featuredWinRate)
  const loseRate = 1 - winRate
  const baseFiveStarPDF = getSingleFiveStarPDF(config, { pityCounter: 0, guaranteedLoses: 0 })

  let result: number[] = [0]

  // loses 表示连续歪的次数：0 表示直接命中，k 表示歪到触发大保底
  for (let loses = 0; loses <= guaranteedAfterLoses; loses += 1) {
    let distribution = fiveStarPDF
    for (let t = 0; t < loses; t += 1) {
      distribution = convolvePDF(distribution, baseFiveStarPDF)
    }

    const winWeight = loses === guaranteedAfterLoses ? 1 : winRate
    const weight = Math.pow(loseRate, loses) * winWeight
    result = addWeightedPDF(result, distribution, weight)
  }

  return result
}

// 计算“抽出 N 个 UP 角色”的分布：对单 UP PDF 做 N-1 次卷积
export function getMultipleUpPDF(singleUpPDF: number[], targetCount: number): number[] {
  const target = Math.max(1, Math.floor(targetCount))
  let result = singleUpPDF.slice()

  for (let i = 1; i < target; i += 1) {
    result = convolvePDF(result, singleUpPDF)
  }

  return result
}

// 将 PDF 转为 CDF，输出给图表渲染使用
export function generateChartData(finalPDF: number[]): { pulls: number; chance: number }[] {
  const data: { pulls: number; chance: number }[] = []
  let cumulative = 0

  for (let i = 1; i < finalPDF.length; i += 1) {
    cumulative += finalPDF[i]
    data.push({ pulls: i, chance: cumulative * 100 })
  }

  return data
}
