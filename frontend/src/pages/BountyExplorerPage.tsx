import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Breadcrumbs,
  Link,
  Paper,
  Divider
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BountyExplorer from '../components/BountyExplorer';
import BountyDetailsModal from '../components/BountyDetailsModal';
import { BountyReference } from '../types/types';
import WalletInfo from '../components/WalletInfo';
import { useAuth } from '../context/AuthContext';

const BountyExplorerPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [selectedBounty, setSelectedBounty] = useState<BountyReference | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);

  const handleViewBountyDetails = (bounty: BountyReference) => {
    setSelectedBounty(bounty);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/">
          Home
        </Link>
        <Typography color="text.primary">Bounty Explorer</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {/* Main content */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(66.666% - 16px)' } }}>
          <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom>
              Bounty Explorer
            </Typography>
            <Typography variant="body1" paragraph>
              Explore all bounties in the GitPaid network. These bounties are stored on the BSV blockchain using the Overlay Network.
            </Typography>
            <Divider sx={{ mb: 3 }} />
            <BountyExplorer />
          </Paper>
        </Box>

        {/* Sidebar */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(33.333% - 16px)' } }}>
          {isAuthenticated && <WalletInfo />}

          <Paper sx={{ p: 3, mt: isAuthenticated ? 4 : 0 }}>
            <Typography variant="h6" gutterBottom>
              About the Overlay Network
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" paragraph>
              The BSV Overlay Network is a protocol layer built on top of the Bitcoin SV blockchain that enables advanced application functionality.
            </Typography>
            <Typography variant="body2" paragraph>
              GitPaid uses two key components of the Overlay Network:
            </Typography>
            <Typography variant="subtitle2" gutterBottom>
              Topic Manager
            </Typography>
            <Typography variant="body2" paragraph>
              The Topic Manager (tm_bounty) processes and validates bounty transactions before they're admitted to the blockchain, ensuring they follow the correct format.
            </Typography>
            <Typography variant="subtitle2" gutterBottom>
              Lookup Service
            </Typography>
            <Typography variant="body2">
              The Lookup Service (ls_bounty) indexes bounty data from the blockchain and provides query capabilities, allowing you to search and filter bounties.
            </Typography>
          </Paper>

          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Bounty Transaction Format
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" paragraph>
              Each bounty is stored as a Bitcoin transaction using PushDrop protocol with the following fields:
            </Typography>
            <Typography variant="body2" component="div">
              <ol>
                <li>Repository Owner</li>
                <li>Repository Name</li>
                <li>Issue Number</li>
                <li>Bounty Amount (in satoshis)</li>
                <li>Funder's Public Key</li>
                <li>Issue Title</li>
                <li>Description</li>
              </ol>
            </Typography>
            <Typography variant="body2">
              This format ensures all relevant bounty information is permanently recorded on the blockchain.
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Bounty details modal */}
      <BountyDetailsModal
        open={detailsModalOpen}
        onClose={handleCloseDetailsModal}
        bountyRef={selectedBounty}
      />
    </Container>
  );
};

export default BountyExplorerPage;