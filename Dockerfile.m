FROM node:boron

# Copy app source
COPY . /restaurantmap

# Set work directory to /src
WORKDIR /restaurantmap

# Install app dependencies
RUN npm install

# Expose port to outside world
EXPOSE 3000

# start command as per package.json
CMD ["npm", "start"]