import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const args = new Set(process.argv.slice(2))
const asJson = args.has('--json')
const strict = args.has('--strict')

const appRoot = process.cwd()
const srcRoot = path.join(appRoot, 'src')
const localeRoot = path.join(srcRoot, 'locales')
const supportedLocales = ['en', 'uz', 'ru']
const namespaces = ['common', 'literal', 'literal.overrides']
const translatableAttributeNames = new Set(['placeholder', 'title', 'label', 'description', 'aria-label', 'alt', 'caption', 'hint', 'eyebrow', 'summary'])
const translatablePropertyNames = new Set(['title', 'label', 'description', 'placeholder', 'message', 'caption', 'hint', 'confirmLabel', 'cancelLabel', 'eyebrow', 'actionLabel', 'emptyTitle', 'emptyDescription', 'subtitle'])
const ignoredFiles = new Set([
  path.join(srcRoot, 'shared', 'i18n', 'i18n.ts'),
  path.join(srcRoot, 'shared', 'i18n', 'translations.ts'),
])
const ignoredPrefixes = [
  path.join(srcRoot, 'locales'),
]
const ignoredLiterals = new Set([
  'Workspace dialog',
  'Close dialog',
  'Close dialog panel',
  'Close',
  'Cancel',
  'Confirm',
  'Error',
  'All',
  'No data',
  'No reports',
  'Online',
  'Environment',
  'Auth',
  'Cognilabs',
  'Cognilabs CIMS',
  'user@example.com',
  'SalesManager',
  'Ibrohim',
  'Ibrohimjonov',
])

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'))
}

function compareLocaleKeys() {
  const issues = []

  for (const namespace of namespaces) {
    const entriesByLocale = Object.fromEntries(
      supportedLocales.map((locale) => [locale, readJson(path.join('src', 'locales', locale, `${namespace}.json`))]),
    )

    const allKeys = new Set(
      supportedLocales.flatMap((locale) => Object.keys(entriesByLocale[locale])),
    )

    for (const key of allKeys) {
      const presentIn = supportedLocales.filter((locale) => key in entriesByLocale[locale])

      if (presentIn.length !== supportedLocales.length) {
        issues.push({
          namespace,
          key,
          missingIn: supportedLocales.filter((locale) => !(key in entriesByLocale[locale])),
        })
      }
    }
  }

  return issues
}

function buildKnownLiteralSet() {
  const known = new Set()

  for (const locale of supportedLocales) {
    for (const namespace of namespaces) {
      const resource = readJson(path.join('src', 'locales', locale, `${namespace}.json`))

      for (const value of Object.values(resource)) {
        if (typeof value === 'string' && value.trim()) {
          known.add(normalizeText(value))
        }
      }
    }
  }

  for (const value of ignoredLiterals) {
    known.add(normalizeText(value))
  }

  return known
}

function walkSourceFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (ignoredFiles.has(fullPath) || ignoredPrefixes.some((prefix) => fullPath.startsWith(prefix))) {
      continue
    }

    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files)
      continue
    }

    if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts') || entry.name.endsWith('.bak')) {
      continue
    }

    files.push(fullPath)
  }

  return files
}

function normalizeText(value) {
  return value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u02BC\u02BB\uFF07\u00B4`]/g, '\'')
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function looksLikeHumanText(value) {
  if (!/[A-Za-z]/.test(value)) {
    return false
  }

  if (value.length < 2) {
    return false
  }

  if (/^(https?:|\/|\.\/|\.\.\/)/.test(value)) {
    return false
  }

  if (/^[A-Z0-9_./:-]+$/.test(value)) {
    return false
  }

  if (/^[a-z0-9_-]+$/.test(value)) {
    return false
  }

  if (/(^|[\s:])(text|bg|border|shadow|ring|fill|stroke|dark:text|dark:bg)-/.test(value)) {
    return false
  }

  return true
}

function collectUncoveredText(knownLiterals) {
  const findings = new Map()

  for (const filePath of walkSourceFiles(srcRoot)) {
    const source = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    function record(kind, value) {
      const normalized = normalizeText(value)

      if (!looksLikeHumanText(normalized) || knownLiterals.has(normalized)) {
        return
      }

      const key = `${filePath}::${kind}::${normalized}`

      findings.set(key, {
        file: path.relative(appRoot, filePath).replace(/\\/g, '/'),
        kind,
        text: normalized,
      })
    }

    function visit(node) {
      if (ts.isJsxText(node)) {
        record('jsx-text', node.getText(sourceFile))
      }

      if (ts.isStringLiteralLike(node)) {
        const parent = node.parent

        if (ts.isJsxAttribute(parent) && translatableAttributeNames.has(parent.name.text)) {
          record(`jsx-attr:${parent.name.text}`, node.text)
        } else if (ts.isPropertyAssignment(parent)) {
          const propertyName =
            ts.isIdentifier(parent.name)
              ? parent.name.text
              : ts.isStringLiteralLike(parent.name)
                ? parent.name.text
                : ''

          if (translatablePropertyNames.has(propertyName)) {
            record(`prop:${propertyName}`, node.text)
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  return [...findings.values()].sort((left, right) => left.file.localeCompare(right.file) || left.text.localeCompare(right.text))
}

const keyIssues = compareLocaleKeys()
const uncoveredText = collectUncoveredText(buildKnownLiteralSet())
const report = {
  localeParityIssues: keyIssues,
  uncoveredText,
  summary: {
    localeParityIssueCount: keyIssues.length,
    uncoveredTextCount: uncoveredText.length,
  },
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`i18n locale parity issues: ${keyIssues.length}`)
  console.log(`i18n uncovered text candidates: ${uncoveredText.length}`)

  if (keyIssues.length > 0) {
    console.log('\nMissing locale keys:')
    for (const issue of keyIssues.slice(0, 50)) {
      console.log(`- [${issue.namespace}] ${issue.key} -> missing in ${issue.missingIn.join(', ')}`)
    }
  }

  if (uncoveredText.length > 0) {
    console.log('\nUncovered user-visible text:')
    for (const finding of uncoveredText.slice(0, 80)) {
      console.log(`- ${finding.file} [${finding.kind}] ${finding.text}`)
    }
  }
}

if (strict && (keyIssues.length > 0 || uncoveredText.length > 0)) {
  process.exitCode = 1
}
