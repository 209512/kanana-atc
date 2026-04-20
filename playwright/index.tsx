import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';
import '../src/index.css';

beforeMount(async ({ hooksConfig }) => {
  // setup before mount
});

afterMount(async ({ hooksConfig }) => {
  // setup after mount
});
