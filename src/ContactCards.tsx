import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlaceIcon from '@mui/icons-material/Place';

interface ContactLink {
  href: string;
  rel?: string;
  type?: string;
  title?: string;
}

interface ContactPhone {
  value: string;
  roles?: string[];
}

interface ContactEmail {
  value: string;
  roles?: string[];
}

interface ContactAddress {
  deliveryPoint?: string[];
  city?: string;
  administrativeArea?: string;
  postalCode?: string;
  country?: string;
  roles?: string[];
}

interface Contact {
  identifier?: string;
  name?: string;
  position?: string;
  organization?: string;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  addresses?: ContactAddress[];
  links?: ContactLink[];
  hoursOfService?: string;
  contactInstructions?: string;
  roles?: string[];
}

interface ContactCardsProps {
  contacts: Contact[];
}

function formatAddress(addr: ContactAddress): string {
  const parts: string[] = [];
  if (addr.deliveryPoint) parts.push(...addr.deliveryPoint);
  if (addr.city) parts.push(addr.city);
  if (addr.administrativeArea) parts.push(addr.administrativeArea);
  if (addr.postalCode) parts.push(addr.postalCode);
  if (addr.country) parts.push(addr.country);
  return parts.join(', ');
}

export default function ContactCards({ contacts }: ContactCardsProps) {
  if (!contacts || contacts.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {contacts.map((contact, index) => (
        <React.Fragment key={contact.identifier || index}>
          {index > 0 && <Divider />}
          <Box>
            {/* Name and Organization */}
            {contact.name && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2" fontWeight="medium">
                  {contact.name}
                </Typography>
              </Box>
            )}
            {contact.organization && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="body2">
                  {contact.organization}
                </Typography>
              </Box>
            )}
            {contact.position && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, ml: 2.5 }}>
                {contact.position}
              </Typography>
            )}

            {/* Roles */}
            {contact.roles && contact.roles.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5, ml: 2.5 }}>
                {contact.roles.map((role) => (
                  <Chip key={role} label={role} size="small" variant="outlined" />
                ))}
              </Box>
            )}

            {/* Emails */}
            {contact.emails?.map((email, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, ml: 2.5 }}>
                <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Link href={`mailto:${email.value}`} variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {email.value}
                </Link>
              </Box>
            ))}

            {/* Phones */}
            {contact.phones?.map((phone, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, ml: 2.5 }}>
                <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Link href={`tel:${phone.value}`} variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {phone.value}
                </Link>
              </Box>
            ))}

            {/* Addresses */}
            {contact.addresses?.map((addr, i) => {
              const formatted = formatAddress(addr);
              if (!formatted) return null;
              return (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.25, ml: 2.5 }}>
                  <PlaceIcon sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25 }} />
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {formatted}
                  </Typography>
                </Box>
              );
            })}

            {/* Links */}
            {contact.links && contact.links.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, ml: 2.5 }}>
                {contact.links.map((link, i) => (
                  <Chip
                    key={i}
                    label={link.title || link.rel || 'Link'}
                    component="a"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    size="small"
                    variant="outlined"
                    icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  />
                ))}
              </Box>
            )}

            {/* Hours / Instructions */}
            {contact.hoursOfService && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 2.5 }}>
                {contact.hoursOfService}
              </Typography>
            )}
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}

/** Type guard to check if a value looks like a contacts array */
export function isContactsArray(value: unknown): value is Contact[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      ('organization' in item || 'name' in item)
  );
}
