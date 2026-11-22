import { useI18n } from '../../app/i18n';
import { useRef, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
export function useConfirmation() {
  const tr = useI18n();
  const [message, setMessage] = useState('');
  const pending = useRef<(value: boolean) => void>(() => {});

  function confirm(text: string) {
    if (message) return Promise.resolve(false);
    setMessage(text);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }

  function finish(value: boolean) {
    setMessage('');
    pending.current(value);
  }

  const dialog = (
    <Dialog open={!!message} onClose={() => finish(false)}>
      <DialogTitle>{tr('确认')}</DialogTitle>
      <DialogContent>{message}</DialogContent>
      <DialogActions>
        <Button onClick={() => finish(false)}>{tr('取消')}</Button>
        <Button onClick={() => finish(true)}>{tr('确认')}</Button>
      </DialogActions>
    </Dialog>
  );

  return {
    confirm,
    dialog,
  };
}
