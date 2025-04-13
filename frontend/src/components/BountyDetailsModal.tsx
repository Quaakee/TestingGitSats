import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Link,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkIcon from '@mui/icons-material/Link';
import { bountyService } from '../services/BountyService';
import { formatSatoshis, satoshisToUSD } from '../services/wallet';
import { Bounty, BountyReference } from '../types/types';

interface BountyDetailsModalProps {
  open: boolean;
  onClose: () => void;
  bountyRef: BountyReference | null;
}

const BountyDetailsModal: React.FC<BountyDetailsModalProps> = ({ open, onClose, bountyRef }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bountyDetails, setBountyDetails] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !bountyRef) return;

    const fetchBountyDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch detailed information about the bounty
        const details = await bountyService.getBountiesByIssue(
          bountyRef.repoOwner?.toString(),
          bountyRef.repoName,
          bountyRef.issueNumber
        );
        
        setBountyDetails(details);
      } catch (error) {
        console.error('Error fetching bounty details:', error);
        setError('Failed to load bounty details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBountyDetails();
  }, [open, bountyRef]);

  if (!bountyRef) return null;

  const issueUrl = `https://github.com/${bountyRef.repoOwner}/${bountyRef.repoName}/issues/${bountyRef.issueNumber}`;
  const blockExplorerUrl = `https://whatsonchain.com/tx/${bountyRef.txid}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Typography variant="h6">Bounty Details</Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" gutterBottom>
                {bountyRef.issueTitle}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <GitHubIcon fontSize="small" sx={{ mr: 0.5 }} />
                <Link 
                  href={issueUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  underline="hover"
                  color="textSecondary"
                >
                  {bountyRef.repoOwner}/{bountyRef.repoName}#{bountyRef.issueNumber}
                </Link>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Chip 
                  label={bountyRef.status.toUpperCase()} 
                  color={bountyRef.status === 'open' ? 'success' : bountyRef.status === 'in-progress' ? 'warning' : 'info'} 
                  size="small" 
                />
                
                <Chip 
                  label={formatSatoshis(bountyRef.amount)} 
                  color="primary" 
                  size="small" 
                />
              </Box>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              Transaction Details
            </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell component="th" scope="row" sx={{ width: '30%' }}>
                      Transaction ID
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          mr: 1
                        }}>
                          {bountyRef.txid}
                        </Typography>
                        <Link 
                          href={blockExplorerUrl}
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <LinkIcon fontSize="small" />
                        </Link>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row">
                      Output Index
                    </TableCell>
                    <TableCell>{bountyRef.outputIndex}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row">
                      Amount
                    </TableCell>
                    <TableCell>
                      {formatSatoshis(bountyRef.amount)} 
                      <Typography component="span" variant="body2" color="textSecondary" sx={{ ml: 1 }}>
                        (approx. {satoshisToUSD(bountyRef.amount)})
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell component="th" scope="row">
                      Status
                    </TableCell>
                    <TableCell>{bountyRef.status.toUpperCase()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            
            {bountyDetails.length > 0 && bountyDetails[0].description && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body2" paragraph>
                  {bountyDetails[0].description}
                </Typography>
              </Box>
            )}
            
            {bountyDetails.length > 0 && bountyDetails[0].funderPublicKey && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Funder Details
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell component="th" scope="row" sx={{ width: '30%' }}>
                          Public Key
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            fontFamily: 'monospace'
                          }}>
                            {bountyDetails[0].funderPublicKey}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {bountyDetails[0].createdAt && (
                        <TableRow>
                          <TableCell component="th" scope="row">
                            Created At
                          </TableCell>
                          <TableCell>
                            {new Date(bountyDetails[0].createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
            
            {bountyDetails.length > 0 && bountyDetails[0].solver && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Solver Details
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell component="th" scope="row" sx={{ width: '30%' }}>
                          Solver
                        </TableCell>
                        <TableCell>{bountyDetails[0].solver}</TableCell>
                      </TableRow>
                      {bountyDetails[0].solverPublicKey && (
                        <TableRow>
                          <TableCell component="th" scope="row">
                            Public Key
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              fontFamily: 'monospace'
                            }}>
                              {bountyDetails[0].solverPublicKey}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose}
          color="primary"
        >
          Close
        </Button>
        
        <Button
          href={issueUrl}
          target="_blank"
          rel="noopener noreferrer"
          color="primary"
          variant="contained"
          startIcon={<GitHubIcon />}
        >
          View on GitHub
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BountyDetailsModal;