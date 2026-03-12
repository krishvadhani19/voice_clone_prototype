# Kill any existing tunnel on port 5111
lsof -ti:5111 | xargs kill -9

# Connect with tunnel
ssh -L 5111:localhost:5111 ra_krish@129.10.224.228