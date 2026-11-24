import { useI18n } from '../../app/i18n';
import { useRef, useState } from 'react';
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
export function ImageGallery({ title, images }: { title: string; images: string[] }) {
  const tr = useI18n();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const transform = useRef<ReactZoomPanPinchRef>(null);

  function select(value: number) {
    setIndex(value);
    setOpen(true);
  }

  function toggleZoom() {
    if (transform.current?.state.scale === 1) {
      transform.current.zoomIn(1);
    } else {
      transform.current?.resetTransform();
    }
  }

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          overflowX: 'auto',
        }}
      >
        {images.map((url, i) => (
          <Button
            key={url}
            onClick={() => select(i)}
            sx={{
              p: 0,
              minWidth: 100,
            }}
          >
            <Box
              component="img"
              src={url}
              alt={`${title} ${i + 1}`}
              sx={{
                width: 100,
                height: 76,
                objectFit: 'cover',
              }}
            />
          </Button>
        ))}
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          {title} · {index + 1}/{images.length}
        </DialogTitle>
        <DialogContent
          sx={{
            overflow: 'auto',
          }}
        >
          <TransformWrapper key={index} ref={transform} maxScale={2.5}>
            <TransformComponent
              wrapperStyle={{ width: '100%' }}
              contentStyle={{ width: '100%', justifyContent: 'center' }}
            >
              <Box
                component="img"
                src={images[index]}
                alt={title}
                sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </TransformComponent>
          </TransformWrapper>
        </DialogContent>
        <DialogActions>
          <Button disabled={index <= 0} onClick={() => select(index - 1)}>
            {tr('上一张')}
          </Button>
          <Button disabled={index >= images.length - 1} onClick={() => select(index + 1)}>
            {tr('下一张')}
          </Button>
          <Button onClick={toggleZoom}>{tr('缩放')}</Button>
          <Button onClick={() => setOpen(false)}>{tr('关闭')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
