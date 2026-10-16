import { describe, it, expect } from 'vitest'
import { formatUSD, formatPercent, calcularSistemaAleman } from './calculatorEngine'

describe('Calculadora Cotripar Engine - Unit Tests', () => {
  describe('formatUSD', () => {
    it('formats numbers into USD currency format correctly', () => {
      expect(formatUSD(1000)).toBe('$ 1,000')
      expect(formatUSD(125000)).toBe('$ 125,000')
    })

    it('handles zero, null, and undefined values safely', () => {
      expect(formatUSD(0)).toBe('$ 0')
      expect(formatUSD(null)).toBe('$ 0')
      expect(formatUSD(undefined)).toBe('$ 0')
    })
  })

  describe('formatPercent', () => {
    it('formats percentages with 2 decimals', () => {
      expect(formatPercent(9.5)).toBe('9.50%')
      expect(formatPercent(12)).toBe('12.00%')
    })

    it('handles null/undefined gracefully', () => {
      expect(formatPercent(null)).toBe('0.00%')
    })
  })

  describe('calcularSistemaAleman', () => {
    it('computes German amortization system with administrative expense and schedule', () => {
      const capital = 100000
      const tasa = 10
      const plazo = 2

      const resultado = calcularSistemaAleman(capital, tasa, plazo, 'anual')

      expect(resultado.capital).toBe(capital)
      expect(resultado.plazoAnios).toBe(plazo)
      expect(resultado.gastoAdmin).toBe(1000) // 1% do capital
      expect(resultado.cronograma).toHaveLength(2)
      expect(resultado.cronograma[0].amortizacion).toBe(50000)
      expect(resultado.cronograma[1].amortizacion).toBe(50000)
      expect(resultado.cronograma[1].saldoFinal).toBe(0)
      expect(resultado.totalPagado).toBeGreaterThan(capital)
    })
  })
})
