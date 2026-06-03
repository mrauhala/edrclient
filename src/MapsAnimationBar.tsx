import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CloseIcon from '@mui/icons-material/Close';
import { useMapsAnimation } from './hooks/useMapsAnimation';

const FPS_OPTIONS = [0.5, 1, 2, 4, 8];

// Floating playback control for OGC API Maps animation bundles — bottom-center map overlay.
// One row per bundle; each frame is a separately-requested /map image, shown one at a time.
export default function MapsAnimationBar() {
  const anim = useMapsAnimation();
  if (!anim.bundles.length) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'min(700px, 92%)',
      }}
    >
      <Stack spacing={1}>
        {anim.bundles.map(b => {
          const time = b.frameTimes[b.currentIndex] ?? '';
          return (
            <Paper key={b.bundleId} elevation={6} sx={{ px: 1.5, py: 1, opacity: 0.97 }}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Tooltip title="Jump to start">
                  <IconButton size="small" aria-label="Jump to start" onClick={() => anim.jumpToStart(b.bundleId)}>
                    <SkipPreviousIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Step back">
                  <IconButton size="small" aria-label="Step back" onClick={() => anim.stepBackward(b.bundleId)}>
                    <NavigateBeforeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={b.isPlaying ? 'Pause' : 'Play'}>
                  <IconButton size="small" color="primary" aria-label={b.isPlaying ? 'Pause' : 'Play'} onClick={() => anim.togglePlay(b.bundleId)}>
                    {b.isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Step forward">
                  <IconButton size="small" aria-label="Step forward" onClick={() => anim.stepForward(b.bundleId)}>
                    <NavigateNextIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Jump to end">
                  <IconButton size="small" aria-label="Jump to end" onClick={() => anim.jumpToEnd(b.bundleId)}>
                    <SkipNextIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Select
                  size="small"
                  value={b.fps}
                  onChange={e => anim.setFps(b.bundleId, Number(e.target.value))}
                  sx={{ height: 30, minWidth: 76 }}
                  aria-label="Playback speed"
                >
                  {FPS_OPTIONS.map(s => (
                    <MenuItem key={s} value={s}>{s} fps</MenuItem>
                  ))}
                </Select>

                <Box sx={{ flex: 1, px: 1 }}>
                  <Slider
                    size="small"
                    min={0}
                    max={Math.max(0, b.frameCount - 1)}
                    value={b.currentIndex}
                    onChange={(_, v) => anim.seek(b.bundleId, Array.isArray(v) ? v[0] : v)}
                    marks={b.frameCount <= 24}
                    aria-label="Frame"
                  />
                </Box>

                <Typography variant="caption" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {b.currentIndex + 1}/{b.frameCount}
                </Typography>

                <Tooltip title="Remove series">
                  <IconButton size="small" aria-label="Remove series" onClick={() => anim.removeBundle(b.bundleId)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Typography
                variant="caption"
                sx={{ display: 'block', textAlign: 'center', mt: 0.5, color: 'text.secondary', fontFamily: 'monospace' }}
              >
                {b.collectionTitle} · {time}
              </Typography>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
