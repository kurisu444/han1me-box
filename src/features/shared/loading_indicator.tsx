import { Box } from '@mui/material';

export type LoadingIndicatorSize = 'sm' | 'md' | 'lg';

const sizeConfig: Record<LoadingIndicatorSize, { barWidth: number; height: number; gap: number }> =
  {
    sm: { barWidth: 3, height: 14, gap: 2.5 },
    md: { barWidth: 3.5, height: 24, gap: 3.5 },
    lg: { barWidth: 4.5, height: 34, gap: 4.5 },
  };

const barDelays = [0, 0.14, 0.28, 0.42];

/**
 * 应用统一的加载动画组件。
 * 独立维护，后续调整动画参数或切换其他动效风格时只需修改此文件。
 */
export function LoadingIndicator({
  size = 'md',
  color = 'primary.main',
  label,
}: {
  size?: LoadingIndicatorSize;
  color?: string;
  label?: string;
}) {
  const { barWidth, height, gap } = sizeConfig[size];

  return (
    <Box
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${gap}px`,
        height,
        '@keyframes waveBar': {
          '0%, 100%': { transform: 'scaleY(0.32)', opacity: 0.45 },
          '45%': { transform: 'scaleY(1)', opacity: 1 },
        },
      }}
    >
      {barDelays.map((delay) => (
        <Box
          key={delay}
          sx={{
            width: barWidth,
            height: '100%',
            borderRadius: 999,
            bgcolor: color,
            transformOrigin: 'center',
            animation: `waveBar 0.9s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s infinite`,
          }}
        />
      ))}
    </Box>
  );
}
