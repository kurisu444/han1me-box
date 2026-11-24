import { useI18n } from '../../app/i18n';
import { useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
export function useConfirmation() {
  const tr = useI18n();
  const [state, setState] = useState({ open: false, message: '' });
  const pending = useRef<(value: boolean) => void>(() => {});

  function confirm(text: string) {
    if (state.open) {
      return Promise.resolve(false);
    }
    setState({ open: true, message: text });
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }

  function finish(value: boolean) {
    setState((prev) => ({ ...prev, open: false }));
    pending.current(value);
  }

  const dialog = (
    <Dialog open={state.open} onClose={() => finish(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{tr('确认')}</DialogTitle>
      <DialogContent sx={{ color: 'text.secondary' }}>{state.message}</DialogContent>
      <DialogActions>
        <Button size="small" color="inherit" onClick={() => finish(false)}>
          {tr('取消')}
        </Button>
        <Button size="small" variant="contained" onClick={() => finish(true)}>
          {tr('确认')}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return {
    confirm,
    dialog,
  };
}
