const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('GistBoard', function () {
  let GistBoard, gistBoard, owner, user1;

  const sampleGist = {
    content: 'Hello world!',
    lat: 6.5244, // Lagos
    lng: 3.3792,
    category: 'general',
    expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();
    GistBoard = await ethers.getContractFactory('GistBoard');
    gistBoard = await GistBoard.deploy();
    await gistBoard.deployed();
  });

  describe('Gist Creation', () => {
    it('should allow a user to create a gist', async () => {
      await expect(
        gistBoard
          .connect(user1)
          .createGist(
            sampleGist.content,
            ethers.utils.parseUnits(sampleGist.lat.toString(), 6),
            ethers.utils.parseUnits(sampleGist.lng.toString(), 6),
            sampleGist.category,
            sampleGist.expiration
          )
      ).to.emit(gistBoard, 'GistCreated');

      const allGists = await gistBoard.getAllGists();
      expect(allGists.length).to.equal(1);
      expect(allGists[0].content).to.equal(sampleGist.content);
    });

    it('should reject gist with invalid coordinates', async () => {
      await expect(
        gistBoard.connect(user1).createGist(
          'Invalid location',
          ethers.utils.parseUnits('91', 6), // invalid latitude
          ethers.utils.parseUnits('200', 6), // invalid longitude
          'spam',
          sampleGist.expiration
        )
      ).to.be.revertedWith('Invalid location');
    });
  });

  describe('Expiration Filtering', () => {
    it('should exclude expired gists from active list', async () => {
      const expiredGist = {
        ...sampleGist,
        content: 'Old post',
        expiration: Math.floor(Date.now() / 1000) - 10,
      };

      await gistBoard
        .connect(user1)
        .createGist(
          expiredGist.content,
          ethers.utils.parseUnits(sampleGist.lat.toString(), 6),
          ethers.utils.parseUnits(sampleGist.lng.toString(), 6),
          'old',
          expiredGist.expiration
        );

      const activeGists = await gistBoard.getActiveGists();
      expect(activeGists.length).to.equal(0);
    });
  });

  describe('Radius Filter', () => {
    it('should return gists within radius', async () => {
      // Create one gist near Lagos
      await gistBoard
        .connect(user1)
        .createGist(
          'Near Lagos',
          ethers.utils.parseUnits('6.5244', 6),
          ethers.utils.parseUnits('3.3792', 6),
          'near',
          sampleGist.expiration
        );

      // Create one far from Lagos (e.g., Abuja)
      await gistBoard
        .connect(user1)
        .createGist(
          'Far from Lagos',
          ethers.utils.parseUnits('9.0578', 6),
          ethers.utils.parseUnits('7.4951', 6),
          'far',
          sampleGist.expiration
        );

      const nearby = await gistBoard.getGistsWithinRadius(
        ethers.utils.parseUnits('6.5244', 6), // Lagos
        ethers.utils.parseUnits('3.3792', 6),
        100000 // 100 km
      );

      expect(nearby.length).to.equal(1);
      expect(nearby[0].content).to.equal('Near Lagos');
    });
  });
});
