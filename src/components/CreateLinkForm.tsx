import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError, createLink } from '../api'
import { ALIAS_MAX_LENGTH, ALIAS_MIN_LENGTH, normalizeUrl, validateAlias } from '../lib/validation'
import type { Link } from '../../shared/api'
import { CreatedLink } from './CreatedLink'

interface FieldErrors {
  url?: string
  alias?: string
  /** Problems that don't belong to a single field (network, server, malformed request). */
  form?: string
}

interface CreateLinkFormProps {
  onCreated: (link: Link) => void
  onViewLinks: () => void
}

/** Puts server-side validation messages next to the field they're about; everything else goes in the form banner. */
function errorsFromApi(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return { form: 'Something went wrong. Please try again.' }
  switch (error.code) {
    case 'INVALID_URL':
    case 'UNSAFE_URL':
    case 'URL_TOO_LONG':
      return { url: error.message }
    case 'INVALID_ALIAS':
    case 'ALIAS_TAKEN':
      return { alias: error.message }
    default:
      return { form: error.message }
  }
}

export function CreateLinkForm({ onCreated, onViewLinks }: CreateLinkFormProps) {
  const id = useId()
  const urlId = `${id}-url`
  const urlErrorId = `${id}-url-error`
  const urlHintId = `${id}-url-hint`
  const aliasId = `${id}-alias`
  const aliasErrorId = `${id}-alias-error`
  const aliasHintId = `${id}-alias-hint`
  const formErrorId = `${id}-form-error`

  const [url, setUrl] = useState('')
  const [alias, setAlias] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Link | null>(null)

  const urlInput = useRef<HTMLInputElement>(null)
  const aliasInput = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)

  function focusFirstError(next: FieldErrors) {
    if (next.url) urlInput.current?.focus()
    else if (next.alias) aliasInput.current?.focus()
  }

  function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
    setUrl(event.target.value)
    if (errors.url || errors.form) setErrors((prev) => ({ ...prev, url: undefined, form: undefined }))
  }

  function handleAliasChange(event: ChangeEvent<HTMLInputElement>) {
    setAlias(event.target.value)
    if (errors.alias || errors.form) setErrors((prev) => ({ ...prev, alias: undefined, form: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const urlResult = normalizeUrl(url)
    const aliasResult = validateAlias(alias)
    if (!urlResult.ok || !aliasResult.ok) {
      const next: FieldErrors = {
        url: urlResult.ok ? undefined : urlResult.message,
        alias: aliasResult.ok ? undefined : aliasResult.message,
      }
      setErrors(next)
      setCreated(null)
      focusFirstError(next)
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setErrors({})
    setCreated(null)
    try {
      const link = await createLink({ url: urlResult.value, alias: aliasResult.value })
      setCreated(link)
      setUrl('')
      setAlias('')
      onCreated(link)
    } catch (error) {
      const next = errorsFromApi(error)
      setErrors(next)
      focusFirstError(next)
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const aliasDescribedBy = [aliasHintId, errors.alias ? aliasErrorId : null].filter(Boolean).join(' ')
  const urlDescribedBy = [urlHintId, errors.url ? urlErrorId : null].filter(Boolean).join(' ')

  return (
    <div className="stack">
      <form className="form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
        {errors.form && (
          <div className="alert alert--error" role="alert" id={formErrorId}>
            {errors.form}
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor={urlId}>
            Long URL
          </label>
          <input
            ref={urlInput}
            id={urlId}
            className="input"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://example.com/a/very/long/link"
            value={url}
            onChange={handleUrlChange}
            aria-required="true"
            aria-invalid={errors.url ? true : undefined}
            aria-describedby={urlDescribedBy}
            readOnly={submitting}
          />
          <p className="field-hint" id={urlHintId}>
            Only http and https links. We&rsquo;ll add https:// if you leave it out.
          </p>
          {errors.url && (
            <p className="field-error" id={urlErrorId}>
              {errors.url}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor={aliasId}>
            Custom alias <span className="field-optional">(optional)</span>
          </label>
          <div className={`input-group${errors.alias ? ' is-invalid' : ''}`}>
            <span className="input-prefix" aria-hidden="true">
              {window.location.host}/
            </span>
            <input
              ref={aliasInput}
              id={aliasId}
              className="input input--bare"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="my-link"
              value={alias}
              onChange={handleAliasChange}
              aria-invalid={errors.alias ? true : undefined}
              aria-describedby={aliasDescribedBy}
              readOnly={submitting}
            />
          </div>
          <p className="field-hint" id={aliasHintId}>
            {ALIAS_MIN_LENGTH}&ndash;{ALIAS_MAX_LENGTH} letters, numbers, hyphens or underscores. Leave blank for a
            random code.
          </p>
          {errors.alias && (
            <p className="field-error" id={aliasErrorId}>
              {errors.alias}
            </p>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {submitting ? 'Shortening…' : 'Shorten link'}
          </button>
        </div>
      </form>

      <div aria-live="polite">{created && <CreatedLink link={created} onViewLinks={onViewLinks} />}</div>
    </div>
  )
}
