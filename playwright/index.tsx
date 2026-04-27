import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';
import '../src/index.css';

beforeMount(async ({ hooksConfig }) => {
  // NOTE: setup before mount
});

afterMount(async ({ hooksConfig }) => {
  // NOTE: setup after mount
});
