import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Paper,
  Tab,
  Tabs
} from '@mui/material';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SearchIcon from '@mui/icons-material/Search';
import ExploreIcon from '@mui/icons-material/Explore';
import { useNavigate } from 'react-router-dom';
import { Bounty, BountyReference } from '../types/types';
import { bountyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BountyCard from '../components/BountyCard';
import WalletInfo from '../components/WalletInfo';
import BountyExplorer from '../components/BountyExplorer';
import BountyDetailsModal from '../components/BountyDetailsModal';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`home-tabpanel-${index}`}
      aria-labelledby={`home-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const Home: React.FC = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState<number>(0);
  const [selectedBounty, setSelectedBounty] = useState<BountyReference | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  
  // Fetch funded bounties if user is authenticated
  useEffect(() => {
    console.log("Home component mounted");
    let isMounted = true;
    const fetchBounties = async () => {
      if (!isAuthenticated) return;
      
      try {
        setLoading(true);
        const fundedBounties = await bountyAPI.getFundedBounties();
        if (isMounted) {
          setBounties(fundedBounties);
          setError(null);
        }
      } catch (error) {
        console.error('Error fetching bounties:', error);
        if (isMounted) {
          setError('Failed to load bounties. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    if (!authLoading && isAuthenticated) {
      fetchBounties();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
      console.log("Home component unmounted");
    };
  }, [isAuthenticated, authLoading]);
  
  const handleCreateBounty = () => {
    navigate('/repositories');
  };
  
  const handleViewDetails = (bounty: Bounty) => {
    navigate(`/repositories/${bounty.repositoryOwner}/${bounty.repositoryName}/issues/${bounty.issueNumber}`);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleOpenDetailsModal = (bountyRef: BountyReference) => {
    setSelectedBounty(bountyRef);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
  };
  
  if (authLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {/* Left column */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(66.666% - 16px)' } }}>
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
            <Typography variant="h4" gutterBottom>
              Welcome to GitPaid
            </Typography>
            <Typography variant="body1" paragraph>
              Fund GitHub issues with BSV bounties and reward developers for their contributions.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              {isAuthenticated ? (
                <>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<MonetizationOnIcon />}
                    onClick={handleCreateBounty}
                    size="large"
                  >
                    Fund a Bounty
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ExploreIcon />}
                    onClick={() => setTabValue(1)}
                    size="large"
                  >
                    Browse Bounties
                  </Button>
                </>
              ) : (
                <Alert severity="info">
                  Please login with GitHub to create and manage bounties.
                </Alert>
              )}
            </Box>
          </Paper>
          
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="home tabs">
              <Tab label="Your Bounties" />
              <Tab label="Bounty Explorer" />
            </Tabs>
          </Box>
          
          <TabPanel value={tabValue} index={0}>
            {isAuthenticated ? (
              loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : bounties.length === 0 ? (
                <Alert severity="info">
                  You haven't funded any bounties yet. Click "Fund a Bounty" to get started.
                </Alert>
              ) : (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Your Funded Bounties
                  </Typography>
                  {bounties.map(bounty => (
                    <BountyCard
                      key={`${bounty._id || bounty.txid}`}
                      bounty={bounty}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </Box>
              )
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                Please login with GitHub to view your bounties.
              </Alert>
            )}
          </TabPanel>
          
          <TabPanel value={tabValue} index={1}>
            <BountyExplorer />
          </TabPanel>
        </Box>
        
        {/* Right column */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(33.333% - 16px)' } }}>
          {isAuthenticated && <WalletInfo />}
          
          <Card sx={{ mt: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                How GitPaid Works
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  1. Fund GitHub Issues
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Create bounties for open issues in GitHub repositories using BSV.
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  2. Developers Solve Issues
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Developers work on issues and submit pull requests to solve them.
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  3. Reward Contributors
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  When a solution is accepted, the bounty is sent to the developer who solved it.
                </Typography>
              </Box>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Blockchain Integration
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" paragraph>
                GitPaid uses the BSV blockchain and the Overlay Network to create and manage bounties in a transparent and secure way.
              </Typography>
              <Typography variant="body2" paragraph>
                Each bounty is recorded on the blockchain, ensuring that funds are securely held until the issue is resolved.
              </Typography>
              <Typography variant="body2">
                Bounty transactions can be verified on the blockchain, providing full transparency for both funders and developers.
              </Typography>
            </CardContent>
          </Card>
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

export default Home;