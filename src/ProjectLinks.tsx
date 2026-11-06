import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import GitHubIcon from '@mui/icons-material/GitHub';
import { bugs, repository, version } from '../package.json';

const SOURCE = repository.url.replace(/^git\+/, '').replace(/\.git$/, '');

const external = { target: '_blank', rel: 'noopener noreferrer', color: 'inherit', underline: 'hover' } as const;

// Where the app comes from, what to do about a bug in it, and which version to name when doing so
export default function ProjectLinks() {
  return (
    <Box sx={{ color: 'text.secondary' }}>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Link {...external} href={SOURCE} variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <GitHubIcon sx={{ fontSize: 18 }} />
          Source on GitHub
        </Link>
        {/* Lined up with the text above, past the icon and the gap */}
        <Box sx={{ mt: 0.5, ml: 3.25, typography: 'caption' }}>
          <Link {...external} href={bugs.url}>Report an issue</Link>
          {' · '}
          <Link {...external} href={`${SOURCE}/releases/tag/v${version}`}>v{version}</Link>
        </Box>
      </Box>
    </Box>
  );
}
