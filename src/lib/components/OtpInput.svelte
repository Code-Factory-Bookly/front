<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    length?: number;
    value?: string;
    label?: string;
    error?: string | null;
    disabled?: boolean;
    onComplete?: (code: string) => void;
  }

  let { length = 6, value = $bindable(''), label, error = null, disabled = false, onComplete }: Props = $props();

  let digits = $state<string[]>(Array.from({ length }, (_, i) => value[i] ?? ''));
  let inputs: (HTMLInputElement | null)[] = [];
  const fieldId = `otp-${Math.random().toString(36).slice(2, 8)}`;

  function sync() {
    value = digits.join('');
    if (digits.every((d) => d !== '')) onComplete?.(value);
  }

  function onInput(index: number, e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const raw = target.value.replace(/\D/g, '');
    if (!raw) {
      digits[index] = '';
      sync();
      return;
    }
    // Si llegan varios digitos de una (autocompletado del teclado, no solo paste), repartirlos.
    const chars = raw.split('');
    let cursor = index;
    for (const char of chars) {
      if (cursor >= length) break;
      digits[cursor] = char;
      cursor++;
    }
    digits = [...digits];
    sync();
    const next = Math.min(cursor, length - 1);
    inputs[next]?.focus();
    inputs[next]?.select();
  }

  function onKeydown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        digits[index] = '';
        digits = [...digits];
        sync();
      } else if (index > 0) {
        e.preventDefault();
        digits[index - 1] = '';
        digits = [...digits];
        sync();
        inputs[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputs[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputs[index + 1]?.focus();
    }
  }

  function onPaste(index: number, e: ClipboardEvent) {
    const pasted = e.clipboardData?.getData('text') ?? '';
    const raw = pasted.replace(/\D/g, '');
    if (!raw) return;
    e.preventDefault();
    let cursor = index;
    for (const char of raw.split('')) {
      if (cursor >= length) break;
      digits[cursor] = char;
      cursor++;
    }
    digits = [...digits];
    sync();
    const next = Math.min(cursor, length - 1);
    inputs[next]?.focus();
  }

  function onFocus(e: FocusEvent) {
    (e.currentTarget as HTMLInputElement).select();
  }

  onMount(() => {
    inputs[0]?.focus();
  });
</script>

<div class="otp" class:has-error={!!error}>
  {#if label}
    <span class="otp__label" id="{fieldId}-label">{label}</span>
  {/if}
  <div class="otp__boxes" role="group" aria-labelledby={label ? `${fieldId}-label` : undefined}>
    {#each digits as digit, i (i)}
      <input
        bind:this={inputs[i]}
        type="text"
        inputmode="numeric"
        autocomplete={i === 0 ? 'one-time-code' : 'off'}
        maxlength={length}
        value={digit}
        {disabled}
        aria-label={`Dígito ${i + 1} de ${length}`}
        aria-invalid={!!error}
        class="otp__box"
        oninput={(e) => onInput(i, e)}
        onkeydown={(e) => onKeydown(i, e)}
        onpaste={(e) => onPaste(i, e)}
        onfocus={onFocus}
      />
    {/each}
  </div>
  {#if error}
    <p class="otp__error">{error}</p>
  {/if}
</div>

<style lang="scss">
  @use '$lib/styles/tokens' as *;

  .otp {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  .otp__label {
    font-size: $fs-sm;
    font-weight: $fw-medium;
    color: $text;
  }

  .otp__boxes {
    display: flex;
    gap: $space-2;
    justify-content: center;
  }

  .otp__box {
    width: 44px;
    height: 52px;
    text-align: center;
    font-size: $fs-xl;
    font-weight: $fw-semibold;
    font-variant-numeric: tabular-nums;
    background: $surface;
    border: 1px solid $border;
    border-radius: $radius-md;
    color: $text;
    transition:
      border-color var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out);

    &:hover:not(:disabled) {
      border-color: color.adjust($border, $lightness: -8%);
    }

    &:focus-visible {
      outline: none;
      border-color: $plum;
      box-shadow: 0 0 0 3px rgba(56, 44, 70, 0.12);
    }

    &:disabled {
      background: $ivory;
      color: $muted;
      cursor: not-allowed;
    }
  }

  .has-error .otp__box {
    border-color: $danger;

    &:focus-visible {
      box-shadow: 0 0 0 3px rgba(217, 107, 104, 0.18);
    }
  }

  .otp__error {
    font-size: $fs-xs;
    color: $danger;
    text-align: center;
  }
</style>
