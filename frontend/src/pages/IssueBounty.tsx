import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Divider,
  Chip
} from '@mui/material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Issue, Repository, Bounty, BountyReference } from '../types/types';
import { repoAPI, bountyAPI } from '../services/api';
import { bountyService } from '../services/BountyService';
import BountyForm from '../components/BountyForm';
import WalletInfo from '../components/WalletInfo';
import BountyCard from '../components/BountyCard';
import BountyDetailsModal from '../components/BountyDetailsModal';
import { useAuth } from '../context/AuthContext';
import { formatSatoshis } from '../services/wallet';
import { toast } from 'react-toastify';
import GitHubIcon from '@mui/icons-material/GitHub';

const IssueBounty: React.FC = () => {
  const { owner, repo, issueNumber } = useParams<{ owner: string; repo: string; issueNumber: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [repository, setRepository] = useState<Repository | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [blockchainBounties, setBlockchainBounties] = useState<BountyReference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedBounty, setSelectedBounty] = useState<BountyReference | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  
  // Fetch repository and issue details
  useEffect(() => {
    console.log("IssueBounty component mounted");
    const fetchData = async () => {
      if (!owner || !repo || !issueNumber) {
        setError('Missing required parameters');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Fetch repositories
        const repos = await repoAPI.getRepositories();
        const foundRepo = repos.find(r => 
          r.owner.toLowerCase() === owner.toLowerCase() && 
          r.name.toLowerCase() === repo.toLowerCase()
        );
        
        if (!foundRepo) {
          setError('Repository not found');
          setLoading(false);
          return;
        }
        
        setRepository(foundRepo);
        
        // Fetch issues for the repository
        const issues = await repoAPI.getIssues(owner, repo);
        const issueId = parseInt(issueNumber);
        const foundIssue = issues.find(i => i.number === issueId);
        
        if (!foundIssue) {
          setError('Issue not found');
          setLoading(false);
          return;
        }
        
        setIssue(foundIssue);
        
        // Fetch bounties from the blockchain
        try {
          const bounties = await bountyService.getBountiesByIssue(
            owner,
            repo,
            issueId
          );
          
          if (bounties && bounties.length > 0) {
            // Map the Bounty[] to BountyReference[]
            const bountyRefs: BountyReference[] = bounties.map(bounty => ({
              repoOwner: bounty.repositoryOwner || owner,
              repoName: bounty.repositoryName || repo,
              issueNumber: bounty.issueNumber || issueId,
              issueTitle: bounty.issueTitle || `Issue #${issueId}`,
              amount: bounty.amount,
              status: bounty.status,
              txid: bounty.txid || '',
              outputIndex: bounty.outputIndex || 0,
              funderPublicKey: bounty.funder?.githubId,
              createdAt: bounty.createdAt,
              updatedAt: bounty.updatedAt
            }));
            
            setBlockchainBounties(bountyRefs);
          }
        } catch (blockchainError) {
          console.error('Error fetching bounties from blockchain:', blockchainError);
          // Continue even if blockchain fetch fails
        }
        
        // If issue has a bounty, fetch bounty details
        if (foundIssue.bounty > 0) {
          try {
            const fundedBounties = await bountyAPI.getFundedBounties();
            const foundBounty = fundedBounties.find(b => 
              b.repositoryOwner.toLowerCase() === owner.toLowerCase() &&
              b.repositoryName.toLowerCase() === repo.toLowerCase() &&
              b.issueNumber === issueId
            );
            
            if (foundBounty) {
              setBounty(foundBounty);
            }
          } catch (error) {
            console.error('Error fetching bounty details:', error);
            // Continue even if bounty details fetch fails
          }
        }
        
        setError(null);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    return () => console.log("IssueBounty component unmounted");
  }, [owner, repo, issueNumber]);
  
  const handleBountySuccess = () => {
    setShowForm(false);
    toast.success('Bounty created successfully!');
    // Reload the page to see updated bounty
    window.open('http://localhost:5173');
  };
  
  const handleCancelForm = () => {
    setShowForm(false);
  };

  const handleViewBlockchainDetails = (bountyRef: BountyReference) => {
    setSelectedBounty(bountyRef);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
  };
  
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  
  if (error || !repository || !issue) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          {error || 'Failed to load issue details'}
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Button 
            variant="outlined" 
            component={RouterLink} 
            to="/repositories"
          >
            Back to Repositories
          </Button>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/">
          Home
        </Link>
        <Link component={RouterLink} to="/repositories">
          Repositories
        </Link>
        <Link 
          component={RouterLink} 
          to={`/repositories/${owner}/${repo}`}
        >
          {repository.fullName}
        </Link>
        <Typography color="text.primary">
          Issue #{issue.number}
        </Typography>
      </Breadcrumbs>
      
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {/* Main content */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(66.666% - 16px)' } }}>
          <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              {issue.title}
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Issue #{issue.number} in {repository.owner}/{repository.name}
            </Typography>
            
            {issue.labels && issue.labels.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {issue.labels.map(label => (
                  <Chip key={label} label={label} size="small" />
                ))}
              </Box>
            )}
            
            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                component="a"
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<GitHubIcon />}
                sx={{ mr: 2 }}
              >
                View on GitHub
              </Button>
              
              <Button
                variant="outlined"
                component={RouterLink}
                to={`/repositories/${owner}/${repo}`}
              >
                Back to Repository
              </Button>
            </Box>
          </Paper>
          
          {showForm ? (
            <BountyForm
              repository={repository}
              issue={issue}
              onSuccess={handleBountySuccess}
              onCancel={handleCancelForm}
            />
          ) : (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {bounty || blockchainBounties.length > 0 ? 'Current Bounties' : 'No Bounty Yet'}
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => setShowForm(true)}
                  disabled={!isAuthenticated}
                >
                  {bounty || blockchainBounties.length > 0 ? 'Add Funds' : 'Fund Bounty'}
                </Button>
              </Box>
              
              {bounty && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Backend-managed Bounty
                  </Typography>
                  <BountyCard bounty={bounty} showActions={false} />
                </Box>
              )}
              
              {blockchainBounties.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Blockchain Bounties
                  </Typography>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    These bounties are recorded directly on the BSV blockchain through the Overlay Network.
                  </Typography>
                  
                  {blockchainBounties.map((bountyRef) => (
                    <Paper 
                      key={`${bountyRef.txid}-${bountyRef.outputIndex}`} 
                      sx={{ p: 2, mb: 2, borderLeft: 3, borderColor: bountyRef.status === 'open' ? 'success.main' : 'warning.main' }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1">
                          {bountyRef.issueTitle}
                        </Typography>
                        <Chip 
                          label={formatSatoshis(bountyRef.amount)} 
                          color="primary" 
                          size="small" 
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip 
                          label={bountyRef.status.toUpperCase()} 
                          color={bountyRef.status === 'open' ? 'success' : 'warning'} 
                          size="small" 
                          variant="outlined"
                        />
                        
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={() => handleViewBlockchainDetails(bountyRef)}
                        >
                          View Details
                        </Button>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
              
              {!bounty && blockchainBounties.length === 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="body1" paragraph>
                    Be the first to fund this issue with a bounty.
                  </Typography>
                  {!isAuthenticated && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Please login with GitHub to create a bounty.
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
        
        {/* Sidebar */}
        <Box sx={{ flexBasis: { xs: '100%', md: 'calc(33.333% - 16px)' } }}>
          {isAuthenticated && <WalletInfo />}
          
          <Paper sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              About Bounties
            </Typography>
            <Typography variant="body2" paragraph>
              Bounties are funded in BSV (Bitcoin SV) and stored on the blockchain using the Overlay Network.
            </Typography>
            <Typography variant="body2" paragraph>
              Each bounty created through GitPaid is recorded as a transaction on the BSV blockchain, ensuring transparency and security.
            </Typography>
            <Typography variant="body2" paragraph>
              When the issue is resolved and the solution is accepted, the bounty is paid to the developer who solved it.
            </Typography>
            <Typography variant="body2">
              You can add additional funds to increase the bounty amount at any time.
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Blockchain Integration
            </Typography>
            <Typography variant="body2">
              GitPaid uses BSV's Overlay Network with topic managers and lookup services to create, broadcast, and query bounties.
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

export default IssueBounty;