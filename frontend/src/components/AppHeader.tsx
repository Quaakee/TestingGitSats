import React from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box, 
  Avatar, 
  IconButton, 
  Menu, 
  MenuItem, 
  Tooltip,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import GitHubIcon from '@mui/icons-material/GitHub';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SearchIcon from '@mui/icons-material/Search';
import ExploreIcon from '@mui/icons-material/Explore';
import FolderIcon from '@mui/icons-material/Folder';
import { useAuth } from '../context/AuthContext';
import { formatSatoshis } from '../services/wallet';

const AppHeader: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };
  
  const handleProfile = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const getTabValue = () => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path.includes('/repositories')) return 1;
    if (path.includes('/bounties')) return 2;
    return false;
  };

  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography 
          variant="h6" 
          component={Link} 
          to="/" 
          sx={{ 
            textDecoration: 'none', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            mr: 4
          }}
        >
          <MonetizationOnIcon sx={{ mr: 1 }} />
          GitPaid
        </Typography>
        
        {!isMobile && (
          <Tabs 
            value={getTabValue()} 
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ flexGrow: 1 }}
          >
            <Tab 
              label="Home" 
              component={Link} 
              to="/" 
              value={0}
              sx={{ color: 'white' }}
            />
            <Tab 
              label="Repositories" 
              component={Link} 
              to="/repositories" 
              value={1}
              sx={{ color: 'white' }}
              icon={<FolderIcon />}
              iconPosition="start"
            />
            <Tab 
              label="Bounty Explorer" 
              component={Link} 
              to="/bounties" 
              value={2}
              sx={{ color: 'white' }}
              icon={<ExploreIcon />}
              iconPosition="start"
            />
          </Tabs>
        )}
        
        {isMobile && (
          <Box sx={{ flexGrow: 1 }} />
        )}
        
        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {user?.walletBalance !== undefined && (
              <Tooltip title="Wallet Balance">
                <Typography variant="body2" sx={{ mr: 2 }}>
                  {formatSatoshis(user.walletBalance)}
                </Typography>
              </Tooltip>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={handleMenuOpen}>
              {user?.avatarUrl ? (
                <Avatar 
                  src={user.avatarUrl} 
                  alt={user.displayName}
                  sx={{ width: 32, height: 32, mr: 1 }}
                />
              ) : (
                <AccountCircleIcon sx={{ mr: 1 }} />
              )}
              <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
                {user?.displayName || user?.username}
              </Typography>
            </Box>
            
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
            >
              <MenuItem onClick={handleProfile}>My Profile</MenuItem>
              {isMobile && (
                <MenuItem onClick={() => navigate('/repositories')}>Repositories</MenuItem>
              )}
              {isMobile && (
                <MenuItem onClick={() => navigate('/bounties')}>Bounty Explorer</MenuItem>
              )}
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        ) : (
          <Button 
            color="inherit" 
            startIcon={<GitHubIcon />}
            onClick={login}
          >
            Login with GitHub
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;