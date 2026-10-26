import type { AppLocale } from './translations'
import { translateLiteral } from './translations'

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const
const LEGACY_TRANSLATION_SKIP_SELECTOR = [
  '[data-i18n-skip="true"]',
  '[data-ui-number="true"]',
  '[data-chat-stream="true"]',
  '[data-activity-strip="true"]',
  '[data-activity-legend="true"]',
  '[data-metric-grid="true"]',
].join(', ')

const textSourceMap = new WeakMap<Text, string>()
const textAppliedMap = new WeakMap<Text, string>()
const attributeSourceMap = new WeakMap<Element, Map<string, string>>()

function preserveEdgeWhitespace(source: string, translated: string) {
  const leading = source.match(/^\s*/)?.[0] ?? ''
  const trailing = source.match(/\s*$/)?.[0] ?? ''
  return `${leading}${translated}${trailing}`
}

function shouldSkipTextNode(node: Text) {
  const parent = node.parentElement

  if (!parent) {
    return true
  }

  if (parent.closest(LEGACY_TRANSLATION_SKIP_SELECTOR)) {
    return true
  }

  return ['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE'].includes(parent.tagName)
}

function applyTextTranslation(locale: AppLocale, node: Text) {
  if (shouldSkipTextNode(node)) {
    return
  }

  const current = node.textContent ?? ''

  if (!current.trim()) {
    return
  }

  const previousSource = textSourceMap.get(node)
  const previousApplied = textAppliedMap.get(node)

  if (previousSource !== undefined && current !== previousSource && current !== previousApplied) {
    textSourceMap.set(node, current)
  }

  const source = textSourceMap.get(node) ?? current
  textSourceMap.set(node, source)

  const translated = preserveEdgeWhitespace(source, translateLiteral(locale, source.trim()))

  if (translated !== current) {
    node.textContent = translated
  }

  textAppliedMap.set(node, translated)
}

function applyAttributeTranslation(locale: AppLocale, element: Element) {
  if (element.closest(LEGACY_TRANSLATION_SKIP_SELECTOR)) {
    return
  }

  let sourceMap = attributeSourceMap.get(element)

  if (!sourceMap) {
    sourceMap = new Map<string, string>()
    attributeSourceMap.set(element, sourceMap)
  }

  TRANSLATABLE_ATTRIBUTES.forEach((attributeName) => {
    const current = element.getAttribute(attributeName)

    if (!current?.trim()) {
      return
    }

    const source = sourceMap!.get(attributeName) ?? current
    sourceMap!.set(attributeName, source)

    const translated = translateLiteral(locale, source)

    if (translated !== current) {
      element.setAttribute(attributeName, translated)
    }
  })
}

function translateSubtree(locale: AppLocale, root: ParentNode) {
  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  let node = treeWalker.nextNode()

  while (node) {
    applyTextTranslation(locale, node as Text)
    node = treeWalker.nextNode()
  }

  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll('*')]
      : Array.from(root.querySelectorAll('*'))

  elements.forEach((element) => applyAttributeTranslation(locale, element))
}

export function observeDomTranslations(locale: AppLocale) {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return () => {}
  }

  const apply = () => translateSubtree(locale, document.body)
  apply()

  const observer = new MutationObserver(() => {
    apply()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  })

  return () => observer.disconnect()
}
