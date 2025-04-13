import React, { useState, useEffect } from 'react';
import { WalletClient, TopicBroadcaster, PushDrop, Transaction, Utils, LookupResolver } from '@bsv/sdk';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  TextField,
  InputAdornment,
  IconButton,
  Button
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import { bountyService } from '../services/BountyService';
import BountyCard from './BountyCard';
import { Bounty, BountyReference } from '../types/types';
import { toast } from 'react-toastify';

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
      id={`bounty-explorer-tabpanel-${index}`}
      aria-labelledby={`bounty-explorer-tab-${index}`}
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

const a11yProps = (index: number) => {
  return {
    id: `bounty-explorer-tab-${index}`,
    'aria-controls': `bounty-explorer-tabpanel-${index}`,
  };
};

const BountyExplorer: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allBounties, setAllBounties] = useState<BountyReference[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBounties, setFilteredBounties] = useState<BountyReference[]>([]);
  const [selectedRepoBounties, setSelectedRepoBounties] = useState<BountyReference[]>([]);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repositories, setRepositories] = useState<any[]>([]);

  // Load all bounties on component mount
  useEffect(() => {
    fetchAllBounties();
    fetchRepositoriesWithBounties();
  }, []);

  // Apply search filter
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBounties(allBounties);
      return;
    }

    const filtered = allBounties.filter(bounty => {
      const searchLower = searchTerm.toLowerCase();
      return (
        bounty.repoOwner?.toString().toLowerCase().includes(searchLower) ||
        bounty.repoName.toLowerCase().includes(searchLower) ||
        bounty.issueTitle.toLowerCase().includes(searchLower) ||
        `#${bounty.issueNumber}`.includes(searchTerm)
      );
    });

    setFilteredBounties(filtered);
  }, [searchTerm, allBounties]);

  const fetchAllBounties = async () => {
    try {
      setLoading(true);
      setError(null);
      const bounties = await bountyService.getAllBounties();
      setAllBounties(bounties);
      setFilteredBounties(bounties);
    } catch (error) {
      console.error('Failed to fetch bounties:', error);
      setError('Failed to fetch bounties from the network. Please try again.');
      toast.error('Failed to load bounties');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositoriesWithBounties = async () => {
    try {
      const repos = await bountyService.getReposWithBounties();
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to fetch repositories with bounties:', error);
      // Don't set error here to avoid blocking the UI if only this request fails
    }
  };

  const fetchBountiesByRepo = async () => {
    if (!repoOwner || !repoName) {
      toast.error('Please enter both repository owner and name');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const bounties = await bountyService.getBountiesByRepo(repoOwner, repoName);
      setSelectedRepoBounties(bounties);
      setTabValue(1); // Switch to repo tab
      toast.success(`Found ${bounties.length} bounties for ${repoOwner}/${repoName}`);
    } catch (error) {
      console.error('Failed to fetch repository bounties:', error);
      setError(`Failed to fetch bounties for ${repoOwner}/${repoName}`);
      toast.error('Failed to load repository bounties');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAllBounties();
    fetchRepositoriesWithBounties();
    toast.info('Refreshing bounty data...');
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRepoOwnerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoOwner(e.target.value);
  };

  const handleRepoNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRepoName(e.target.value);
  };

  const handleViewDetails = (bounty: BountyReference) => {
    // Navigate to issue details page
    window.location.href = `/repositories/${bounty.repoOwner}/${bounty.repoName}/issues/${bounty.issueNumber}`;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Bounty Explorer</Typography>
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="bounty explorer tabs"
          sx={{ mb: 2 }}
        >
          <Tab label="All Bounties" {...a11yProps(0)} />
          <Tab label="By Repository" {...a11yProps(1)} />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TabPanel value={tabValue} index={0}>
          <TextField
            fullWidth
            placeholder="Search bounties..."
            variant="outlined"
            value={searchTerm}
            onChange={handleSearch}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredBounties.length === 0 ? (
            <Alert severity="info">
              No bounties found. Try creating a new bounty or adjusting your search.
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Showing {filteredBounties.length} bounties
              </Typography>
              
              {filteredBounties.map((bounty) => (
                <BountyCard
                  key={`${bounty.txid}-${bounty.outputIndex}`}
                  bounty={{
                    repositoryOwner: bounty.repoOwner?.toString(), 
                    repositoryName: bounty.repoName,
                    issueNumber: bounty.issueNumber,
                    issueTitle: bounty.issueTitle,
                    amount: bounty.amount,
                    status: bounty.status = 'open',
                    txid: bounty.txid,
                    outputIndex: bounty.outputIndex,
                    funder: { githubId: '', username: 'Unknown' },
                    solver: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }}
                  onViewDetails={() => handleViewDetails(bounty)}
                />
              ))}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Search by Repository
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Repository Owner"
                variant="outlined"
                fullWidth
                value={repoOwner}
                onChange={handleRepoOwnerChange}
                placeholder="e.g., bitcoin-sv"
              />
              
              <TextField
                label="Repository Name"
                variant="outlined"
                fullWidth
                value={repoName}
                onChange={handleRepoNameChange}
                placeholder="e.g., bsv-overlay"
              />
              
              <Button 
                variant="contained" 
                color="primary"
                onClick={fetchBountiesByRepo}
                disabled={loading || !repoOwner || !repoName}
              >
                Search
              </Button>
            </Box>
            
            {repositories.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Repositories with bounties:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {repositories.map((repo) => (
                    <Button 
                      key={`${repo.repoOwner}/${repo.repoName}`}
                      variant="outlined" 
                      size="small"
                      onClick={() => {
                        setRepoOwner(repo.repoOwner);
                        setRepoName(repo.repoName);
                        fetchBountiesByRepo();
                      }}
                      sx={{ mb: 1 }}
                    >
                      {repo.repoOwner}/{repo.repoName} ({repo.totalBounties})
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedRepoBounties.length > 0 ? (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Bounties for {repoOwner}/{repoName}
              </Typography>
              
              {selectedRepoBounties.map((bounty) => (
                <BountyCard
                  key={`${bounty.txid}-${bounty.outputIndex}`}
                  bounty={{
                    repositoryOwner: bounty.repoOwner?.toString(),
                    repositoryName: bounty.repoName,
                    issueNumber: bounty.issueNumber,
                    issueTitle: bounty.issueTitle,
                    amount: bounty.amount,
                    status: bounty.status = 'open',
                    txid: bounty.txid,
                    outputIndex: bounty.outputIndex,
                    funder: { githubId: '', username: 'Unknown' },
                    solver: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }}
                  onViewDetails={() => handleViewDetails(bounty)}
                />
              ))}
            </Box>
          ) : (
            repoOwner && repoName ? (
              <Alert severity="info">
                No bounties found for {repoOwner}/{repoName}
              </Alert>
            ) : (
              <Alert severity="info">
                Enter a repository owner and name to search for bounties
              </Alert>
            )
          )}
        </TabPanel>
      </CardContent>
    </Card>
  );
};

export default BountyExplorer;